import { onRequest } from "firebase-functions/v2/https";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import Stripe from "stripe";
import { db } from "../shared/firebase";
import { stripeSecretKey, stripeWebhookSecret } from "../shared/secrets";
import { sendEmail, logEmail } from "../email/service";

// ============================================
// PRICING CONFIGURATION
// ============================================

// Pricing config - 150% margin with Gemini 3 Flash @ $0.01/page
// Free trial: 2 weeks, 5 documents, 50 pages
const PLAN_CONFIG: Record<string, {
  name: string;
  pagesPerMonth: number;
  documentsPerMonth: number; // -1 = unlimited
  overagePerPage: number;
  monthlyPrice: number;
  trialDays?: number;
}> = {
  free: { name: "Free Trial", pagesPerMonth: 50, documentsPerMonth: 5, overagePerPage: 0, monthlyPrice: 0, trialDays: 14 },
  starter: { name: "Starter", pagesPerMonth: 0, documentsPerMonth: -1, overagePerPage: 0.05, monthlyPrice: 0 },
  pro: { name: "Pro", pagesPerMonth: 2000, documentsPerMonth: -1, overagePerPage: 0.04, monthlyPrice: 49 },
  "pro-yearly": { name: "Pro (Annual)", pagesPerMonth: 2000, documentsPerMonth: -1, overagePerPage: 0.04, monthlyPrice: 39 },
  team: { name: "Team", pagesPerMonth: 4000, documentsPerMonth: -1, overagePerPage: 0.035, monthlyPrice: 99 },
  "team-yearly": { name: "Team (Annual)", pagesPerMonth: 4000, documentsPerMonth: -1, overagePerPage: 0.035, monthlyPrice: 79 },
  business: { name: "Business", pagesPerMonth: 7000, documentsPerMonth: -1, overagePerPage: 0.03, monthlyPrice: 179 },
  "business-yearly": { name: "Business (Annual)", pagesPerMonth: 7000, documentsPerMonth: -1, overagePerPage: 0.03, monthlyPrice: 149 },
  enterprise: { name: "Enterprise", pagesPerMonth: 16000, documentsPerMonth: -1, overagePerPage: 0.025, monthlyPrice: 399 },
  "enterprise-yearly": { name: "Enterprise (Annual)", pagesPerMonth: 16000, documentsPerMonth: -1, overagePerPage: 0.025, monthlyPrice: 329 },
};

// ============================================
// HELPER: Get user by Stripe customer ID
// ============================================

const getUserIdByCustomerId = async (customerId: string): Promise<string | null> => {
  try {
    const snap = await db.collection("users")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();
    if (!snap.empty) {
      return snap.docs[0].id;
    }
    return null;
  } catch (e) {
    logger.error("Error looking up user by Stripe customerId", { customerId, error: (e as Error).message });
    return null;
  }
};

// ============================================
// HELPER: Extract plan info from subscription
// ============================================

const extractPlanInfo = (subscription: Stripe.Subscription) => {
  const firstItem = subscription.items?.data?.[0];
  const price = firstItem?.price;
  const priceId = price?.id || null;
  const productId = price?.product ? (typeof price.product === "string" ? price.product : price.product.id) : null;
  const planId = (price?.metadata as any)?.planId || subscription.metadata?.planId || null;
  return { planId, priceId, productId };
};

// ============================================
// HELPER: Update user subscription in Firestore
// ============================================

const updateUserSubscription = async (userId: string, data: Record<string, any>) => {
  const subscriptionData: Record<string, any> = {
    status: data.status,
    cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
    updatedAt: new Date(),
  };
  
  if (data.currentPeriodEnd) subscriptionData.currentPeriodEnd = data.currentPeriodEnd;
  if (data.trialEnd) subscriptionData.trialEnd = data.trialEnd;
  if (data.planId) subscriptionData.planId = data.planId;
  if (data.priceId) subscriptionData.priceId = data.priceId;
  if (data.productId) subscriptionData.productId = data.productId;
  if (data.stripeSubscriptionId) subscriptionData.stripeSubscriptionId = data.stripeSubscriptionId;
  if (data.stripeSubscriptionItemId) subscriptionData.stripeSubscriptionItemId = data.stripeSubscriptionItemId;
  if (data.pagesLimit !== undefined) subscriptionData.pagesLimit = data.pagesLimit;
  if (data.documentsLimit !== undefined) subscriptionData.documentsLimit = data.documentsLimit;
  if (data.overagePerPage !== undefined) subscriptionData.overagePerPage = data.overagePerPage;
  
  await db.collection("users").doc(userId).set({
    subscriptionStatus: data.status,
    subscription: subscriptionData,
    ...(data.stripeSubscriptionId ? { stripeSubscriptionId: data.stripeSubscriptionId } : {}),
    updatedAt: new Date(),
  }, { merge: true });
};

// ============================================
// CREATE STRIPE CUSTOMER (on user signup)
// ============================================

export const createStripeCustomer = onDocumentCreated(
  {
    document: "users/{userId}",
    secrets: [stripeSecretKey],
  },
  async (event) => {
    const userData = event.data?.data();
    const userId = event.params.userId;
    
    if (!userData) return;
    
    // Skip if already has Stripe customer ID
    if (userData.stripeCustomerId) {
      logger.info("User already has Stripe customer ID", { userId });
      return;
    }
    
    try {
      const stripe = new Stripe(stripeSecretKey.value());
      
      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.name || userData.displayName,
        metadata: {
          firebaseUserId: userId,
        },
      });
      
      // Update user doc with Stripe customer ID and free trial
      // Free trial: 2 weeks, 5 documents, 50 pages
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 2 weeks
      
      await db.collection("users").doc(userId).update({
        stripeCustomerId: customer.id,
        subscriptionStatus: "trialing",
        subscription: {
          status: "trialing",
          plan: "free",
          planId: "free",
          pagesUsed: 0,
          pagesLimit: 50,
          documentsUsed: 0,
          documentsLimit: 5,
          overagePerPage: 0,
          trialStart: now,
          trialEnd: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          updatedAt: now,
        },
      });
      
      logger.info(`✅ Created Stripe customer ${customer.id} for user ${userId}`);
    } catch (error) {
      logger.error("Error creating Stripe customer:", { error, userId });
    }
  }
);

// ============================================
// CREATE CHECKOUT SESSION
// ============================================

export const createCheckoutSession = onCall(
  {
    secrets: [stripeSecretKey],
    cors: true,
  },
  async (request) => {
    const { priceId, planId, successUrl, cancelUrl } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    try {
      const stripe = new Stripe(stripeSecretKey.value());
      
      // Get user's Stripe customer ID
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.stripeCustomerId) {
        throw new HttpsError("failed-precondition", "No Stripe customer found");
      }

      // Prevent creating multiple subscriptions for existing active users
      const currentStatus = userData.subscription?.status || userData.subscriptionStatus;
      const hasStripeSubscription = !!(userData.stripeSubscriptionId || userData.subscription?.stripeSubscriptionId);
      if (hasStripeSubscription || (currentStatus && ["active", "past_due", "unpaid"].includes(currentStatus))) {
        throw new HttpsError("failed-precondition", "Subscription already exists. Use plan change instead.");
      }

      // Ensure planId is set (fallback to price metadata if missing)
      let resolvedPlanId = planId;
      if (!resolvedPlanId && priceId) {
        const price = await stripe.prices.retrieve(priceId);
        resolvedPlanId = (price.metadata as any)?.planId || null;
      }
      
      // Pay-as-you-go doesn't get a trial (metered billing starts immediately)
      const isPayAsYouGo = resolvedPlanId === "starter";
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: userData.stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            // For metered billing, quantity is not specified
            ...(isPayAsYouGo ? {} : { quantity: 1 }),
          },
        ],
        mode: "subscription",
        success_url: successUrl || `${request.rawRequest?.headers.origin}/settings?tab=billing&success=true`,
        cancel_url: cancelUrl || `${request.rawRequest?.headers.origin}/settings?tab=billing&cancelled=true`,
        metadata: {
          userId,
          planId: resolvedPlanId || "pro",
        },
        subscription_data: {
          metadata: {
            userId,
            planId: resolvedPlanId || "pro",
          },
          // 2-week trial for non-metered plans only
          ...(isPayAsYouGo ? {} : { trial_period_days: 14 }),
        },
        allow_promotion_codes: true,
      });
      
      logger.info("✅ Created checkout session", { sessionId: session.id, userId, planId: resolvedPlanId });
      
      return { sessionId: session.id, url: session.url };
    } catch (error: any) {
      logger.error("Error creating checkout session:", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// UPDATE SUBSCRIPTION PLAN
// ============================================

export const updateSubscriptionPlan = onCall(
  {
    secrets: [stripeSecretKey],
    cors: true,
  },
  async (request) => {
    const { priceId, planId, isDowngrade } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!priceId) {
      throw new HttpsError("invalid-argument", "Missing priceId");
    }
    
    try {
      const stripe = new Stripe(stripeSecretKey.value());
      
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.stripeCustomerId) {
        throw new HttpsError("failed-precondition", "No Stripe customer found");
      }
      
      let subscriptionId = userData?.stripeSubscriptionId || userData?.subscription?.stripeSubscriptionId;
      
      if (!subscriptionId) {
        const subs = await stripe.subscriptions.list({
          customer: userData.stripeCustomerId,
          status: "all",
          limit: 1,
        });
        subscriptionId = subs.data[0]?.id;
      }
      
      if (!subscriptionId) {
        throw new HttpsError("failed-precondition", "No active subscription found");
      }
      
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const itemId = subscription.items.data[0]?.id;
      
      if (!itemId) {
        throw new HttpsError("failed-precondition", "Subscription item not found");
      }
      
      const updated = await stripe.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: isDowngrade ? "none" : "create_prorations",
        cancel_at_period_end: false,
        metadata: {
          ...(subscription.metadata || {}),
          planId: planId || subscription.metadata?.planId || "",
        },
      });
      
      logger.info("✅ Updated subscription plan", { userId, subscriptionId, priceId, planId });
      
      return { subscriptionId: updated.id };
    } catch (error: any) {
      logger.error("Error updating subscription plan", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// CREATE CUSTOMER PORTAL SESSION
// ============================================

export const createPortalSession = onCall(
  {
    secrets: [stripeSecretKey],
    cors: true,
  },
  async (request) => {
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    try {
      const stripe = new Stripe(stripeSecretKey.value());
      
      // Get user's Stripe customer ID
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData?.stripeCustomerId) {
        throw new HttpsError("failed-precondition", "No Stripe customer found");
      }
      
      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: userData.stripeCustomerId,
        return_url: `${request.rawRequest?.headers.origin}/settings`,
      });
      
      logger.info("✅ Created portal session", { userId });
      
      return { url: session.url };
    } catch (error: any) {
      logger.error("Error creating portal session:", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// STRIPE WEBHOOK HANDLER
// ============================================

export const stripeWebhook = onRequest({
  region: "us-central1",
  secrets: [stripeSecretKey, stripeWebhookSecret],
  // IMPORTANT: Do NOT use cors for webhooks - it can interfere with raw body
  // Stripe doesn't send CORS headers and doesn't need CORS support
}, async (req, res) => {
  // Handle CORS preflight manually if needed (shouldn't happen with Stripe)
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const stripe = new Stripe(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      logger.error("❌ Missing Stripe signature header");
      res.status(400).send("Missing Stripe signature");
      return;
    }

    // Firebase Functions v2 provides rawBody when body is parsed
    // This is CRITICAL for Stripe signature verification
    const rawBody = req.rawBody;
    
    if (!rawBody) {
      // This should not happen in Firebase Functions v2, but log it if it does
      logger.error("❌ req.rawBody not available - signature verification will fail", {
        bodyType: typeof req.body,
        isBuffer: Buffer.isBuffer(req.body),
        hasBody: !!req.body,
      });
      res.status(500).send("Server configuration error: rawBody not available");
      return;
    }
    
    logger.info("🔔 Stripe webhook received", { 
      rawBodyLength: rawBody.length,
      contentType: req.headers["content-type"],
    });
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, stripeWebhookSecret.value());
      logger.info("✅ Stripe signature verified", { eventType: event.type, eventId: event.id });
    } catch (err: any) {
      logger.error("❌ Stripe signature verification failed", { 
        message: err.message,
        rawBodyLength: rawBody.length,
        sigHeader: sig.substring(0, 30) + "...",
      });
      res.status(400).send(`Webhook signature verification failed: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      // ============================================
      // CHECKOUT COMPLETED
      // ============================================
      case "checkout.session.completed": {
        try {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const planId = session.metadata?.planId;
          
          if (!userId) {
            logger.warn("Checkout completed without userId in metadata", { sessionId: session.id });
            break;
          }
          
          logger.info("✅ Checkout completed", { sessionId: session.id, userId, planId });
          
          // Send welcome email
          const userDoc = await db.collection("users").doc(userId).get();
          const userData = userDoc.data();
          
          if (userData?.email) {
            const planConfig = PLAN_CONFIG[planId || "pro"] || PLAN_CONFIG.pro;
            
            await sendEmail({
              to: userData.email,
              subject: `🎉 Welcome to ${planConfig.name} - Your Trial Has Started!`,
              content: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #0891B2;">🎉 Welcome to Your Free Trial!</h1>
                  <p>Hi ${userData.name || "there"},</p>
                  <p>Your 2-week free trial of <strong>${planConfig.name}</strong> has started!</p>
                  
                  <div style="background: #f0fdfa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #0891B2;">Your Plan Includes:</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li><strong>${planConfig.pagesPerMonth.toLocaleString()}</strong> pages per month</li>
                      <li>AI-powered extraction</li>
                      <li>All export formats</li>
                      <li>Priority support</li>
                    </ul>
                  </div>
                  
                  <p>Get started by uploading your first bank statement:</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.finflow.io/upload" 
                       style="background: #0891B2; color: white; padding: 14px 28px; 
                              text-decoration: none; border-radius: 8px; display: inline-block;">
                      Upload Statement
                    </a>
                  </div>
                  
                  <p style="color: #666;">Questions? Reply to this email or contact support@finflow.io</p>
                </div>
              `,
            });
            
            await logEmail({
              to: userData.email,
              subject: "Welcome to Your Free Trial",
              type: "trial_started",
              userId,
              status: "sent",
              metadata: { sessionId: session.id, planId },
              trigger: "checkout_session_completed",
            });
          }
        } catch (err) {
          logger.error("Error handling checkout.session.completed", { error: err });
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION CREATED
      // ============================================
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        const userId = (sub.metadata as any)?.userId || await getUserIdByCustomerId(customerId);
        const { planId, priceId, productId } = extractPlanInfo(sub);
        
        if (!userId) {
          logger.error("⚠️ CRITICAL: Subscription created but cannot find user!", { 
            subscriptionId: sub.id, 
            customerId, 
            status: sub.status 
          });
          break;
        }
        
        try {
          const planConfig = PLAN_CONFIG[planId || "pro"] || PLAN_CONFIG.pro;
          const isPayAsYouGo = planId === "starter";
          
          // Get subscription item ID (needed for metered billing usage reporting)
          const subscriptionItemId = sub.items?.data?.[0]?.id || null;
          
          const subAny = sub as any;
          await db.collection("users").doc(userId).set({
            subscriptionStatus: sub.status,
            stripeSubscriptionId: sub.id,
            subscription: {
              status: sub.status,
              planId: planId || "pro",
              priceId,
              productId,
              stripeSubscriptionId: sub.id,
              stripeSubscriptionItemId: subscriptionItemId, // For metered billing
              pagesLimit: isPayAsYouGo ? -1 : planConfig.pagesPerMonth, // -1 = unlimited
              pagesUsed: 0,
              documentsLimit: isPayAsYouGo ? -1 : planConfig.documentsPerMonth,
              documentsUsed: 0,
              overagePerPage: planConfig.overagePerPage,
              cancelAtPeriodEnd: sub.cancel_at_period_end || false,
              currentPeriodEnd: subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : null,
              trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
              updatedAt: new Date(),
            },
          }, { merge: true });
          
          logger.info("✅ Handled subscription.created", { 
            userId, 
            status: sub.status, 
            planId, 
            subscriptionId: sub.id,
            subscriptionItemId,
            isPayAsYouGo,
          });
        } catch (e) {
          logger.error("Error handling subscription.created", { error: e, subscriptionId: sub.id, userId });
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION UPDATED
      // ============================================
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = String(sub.customer);
        const userId = (sub.metadata as any)?.userId || await getUserIdByCustomerId(customerId);
        const { planId, priceId, productId } = extractPlanInfo(sub);
        
        if (!userId) {
          logger.error("⚠️ Subscription updated but cannot find user!", { subscriptionId: sub.id, customerId });
          break;
        }
        
        try {
          const planConfig = PLAN_CONFIG[planId || "pro"] || PLAN_CONFIG.pro;
          const isPayAsYouGo = planId === "starter";
          const subscriptionItemId = sub.items?.data?.[0]?.id || null;
          const subAny = sub as any;
          
          await updateUserSubscription(userId, {
            status: sub.status,
            planId: planId || "pro",
            priceId,
            productId,
            stripeSubscriptionId: sub.id,
            stripeSubscriptionItemId: subscriptionItemId,
            pagesLimit: isPayAsYouGo ? -1 : planConfig.pagesPerMonth,
            documentsLimit: isPayAsYouGo ? -1 : planConfig.documentsPerMonth,
            overagePerPage: planConfig.overagePerPage,
            currentPeriodEnd: subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : null,
            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
          
          logger.info("✅ Handled subscription.updated", { 
            userId, 
            status: sub.status, 
            planId, 
            subscriptionId: sub.id,
            subscriptionItemId,
            isPayAsYouGo,
          });
        } catch (e) {
          logger.error("Error handling subscription.updated", { error: e, subscriptionId: sub.id });
        }
        break;
      }

      // ============================================
      // INVOICE PAYMENT SUCCEEDED
      // ============================================
      case "invoice.payment_succeeded": {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          const invoiceAny = invoice as any;
          const customerId = String(invoice.customer);
          
          // Handle new Stripe API structure
          let subscriptionId: string | undefined;
          const parent = invoiceAny.parent;
          if (parent?.subscription_details?.subscription) {
            subscriptionId = parent.subscription_details.subscription;
          } else if (typeof invoiceAny.subscription === "string") {
            subscriptionId = invoiceAny.subscription;
          }
          
          if (!subscriptionId) {
            logger.warn("invoice.payment_succeeded without subscription id");
            break;
          }
          
          const stripe = new Stripe(stripeSecretKey.value());
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const subAny = sub as any;
          const { planId } = extractPlanInfo(sub);
          
          const lineItems = invoiceAny.lines?.data || [];
          const lineItemUserId = lineItems[0]?.metadata?.userId;
          const userId = sub.metadata?.userId || lineItemUserId || await getUserIdByCustomerId(customerId);
          
          if (!userId) {
            logger.warn("Payment succeeded but user not found", { subscriptionId, customerId });
            break;
          }
          
          // Reset monthly page and document count on successful payment
          const planConfig = PLAN_CONFIG[planId || "pro"] || PLAN_CONFIG.pro;
          
          await db.collection("users").doc(userId).update({
            "subscription.status": "active",
            "subscription.pagesUsed": 0,
            "subscription.pagesLimit": planConfig.pagesPerMonth,
            "subscription.documentsUsed": 0,
            "subscription.documentsLimit": planConfig.documentsPerMonth,
            "subscription.currentPeriodEnd": subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : null,
            "subscription.lastPaymentDate": new Date(),
            updatedAt: new Date(),
          });
          
          // Record payment in payments collection
          await db.collection("payments").add({
            userId,
            stripeInvoiceId: invoice.id,
            stripeSubscriptionId: subscriptionId,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "succeeded",
            planId: planId || "pro",
            billingReason: invoice.billing_reason,
            createdAt: new Date(),
          });
          
          // Also store invoice in user's invoices subcollection for billing page
          await db.collection("users").doc(userId).collection("invoices").doc(invoice.id).set({
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "paid",
            planId: planId || "pro",
            invoicePdf: invoice.invoice_pdf || null,
            hostedInvoiceUrl: invoice.hosted_invoice_url || null,
            billingReason: invoice.billing_reason,
            created: new Date(),
          });
          
          // Send payment confirmation email
          const userDoc = await db.collection("users").doc(userId).get();
          const userData = userDoc.data();
          
          if (userData?.email) {
            const amountPaid = invoice.amount_paid ? (invoice.amount_paid / 100).toFixed(2) : "0.00";
            const isFirstPayment = invoice.billing_reason === "subscription_create";
            
            await sendEmail({
              to: userData.email,
              subject: isFirstPayment 
                ? "🎉 Welcome - Payment Confirmed!" 
                : "✅ Payment Confirmed - Pages Reset!",
              content: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #10b981;">✅ Payment Confirmed</h1>
                  <p>Hi ${userData.name || "there"},</p>
                  <p>Your payment of <strong>$${amountPaid}</strong> has been processed successfully.</p>
                  
                  <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #059669;">Your Pages Have Been Reset!</h3>
                    <p style="margin: 0; font-size: 24px; font-weight: bold; color: #059669;">
                      ${planConfig.pagesPerMonth.toLocaleString()} pages available
                    </p>
                  </div>
                  
                  <p style="color: #666;">
                    Your next billing date: ${subAny.current_period_end 
                      ? new Date(subAny.current_period_end * 1000).toLocaleDateString() 
                      : "N/A"}
                  </p>
                </div>
              `,
            });
            
            await logEmail({
              to: userData.email,
              subject: "Payment Confirmed",
              type: "payment_succeeded",
              userId,
              status: "sent",
              metadata: { invoiceId: invoice.id, amount: invoice.amount_paid, planId },
              trigger: "invoice_payment_succeeded",
            });
          }
          
          logger.info("✅ Handled invoice.payment_succeeded", { 
            subscriptionId, 
            userId, 
            amount: invoice.amount_paid,
            planId 
          });
        } catch (err) {
          logger.error("Error handling invoice.payment_succeeded", { error: err });
        }
        break;
      }

      // ============================================
      // INVOICE PAYMENT FAILED
      // ============================================
      case "invoice.payment_failed": {
        try {
          const invoice = event.data.object as Stripe.Invoice;
          const invoiceAny = invoice as any;
          const customerId = String(invoice.customer);
          
          let subscriptionId: string | undefined;
          const parent = invoiceAny.parent;
          if (parent?.subscription_details?.subscription) {
            subscriptionId = parent.subscription_details.subscription;
          } else if (typeof invoiceAny.subscription === "string") {
            subscriptionId = invoiceAny.subscription;
          }
          
          if (!subscriptionId) break;
          
          const stripe = new Stripe(stripeSecretKey.value());
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const subAny = sub as any;
          const userId = sub.metadata?.userId || await getUserIdByCustomerId(customerId);
          
          if (!userId) break;
          
          await updateUserSubscription(userId, {
            status: "past_due",
            currentPeriodEnd: subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
          
          // Send payment failed email
          const userDoc = await db.collection("users").doc(userId).get();
          const userData = userDoc.data();
          
          if (userData?.email) {
            await sendEmail({
              to: userData.email,
              subject: "⚠️ Payment Failed - Action Required",
              content: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #dc2626;">⚠️ Payment Failed</h1>
                  <p>Hi ${userData.name || "there"},</p>
                  <p>We were unable to process your payment. Please update your payment method to continue using the service.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.finflow.io/settings" 
                       style="background: #dc2626; color: white; padding: 14px 28px; 
                              text-decoration: none; border-radius: 8px; display: inline-block;">
                      Update Payment Method
                    </a>
                  </div>
                </div>
              `,
            });
          }
          
          logger.info("⚠️ Handled invoice.payment_failed", { subscriptionId, userId });
        } catch (err) {
          logger.error("Error handling invoice.payment_failed", { error: err });
        }
        break;
      }

      // ============================================
      // SUBSCRIPTION DELETED (CANCELLED)
      // ============================================
      case "customer.subscription.deleted": {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = String(subscription.customer);
          const userId = subscription.metadata?.userId || await getUserIdByCustomerId(customerId);
          
          if (!userId) break;
          
          // Downgrade to free tier
          await db.collection("users").doc(userId).update({
            subscriptionStatus: "canceled",
            "subscription.status": "canceled",
            "subscription.planId": "free",
            "subscription.pagesLimit": 50,
            "subscription.overagePerPage": 0,
            "subscription.canceledAt": new Date(),
            updatedAt: new Date(),
          });
          
          // Send cancellation email
          const userDoc = await db.collection("users").doc(userId).get();
          const userData = userDoc.data();
          
          if (userData?.email) {
            await sendEmail({
              to: userData.email,
              subject: "👋 Subscription Cancelled - We'll Miss You!",
              content: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #6b7280;">👋 We're sad to see you go</h1>
                  <p>Hi ${userData.name || "there"},</p>
                  <p>Your subscription has been cancelled. You've been moved to our free tier (50 pages/month).</p>
                  
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Changed your mind?</strong></p>
                    <p style="margin: 10px 0 0 0;">You can resubscribe anytime to get full access back.</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://app.finflow.io/pricing" 
                       style="background: #0891B2; color: white; padding: 14px 28px; 
                              text-decoration: none; border-radius: 8px; display: inline-block;">
                      View Plans
                    </a>
                  </div>
                </div>
              `,
            });
          }
          
          logger.info("👋 Handled subscription.deleted", { subscriptionId: subscription.id, userId });
        } catch (err) {
          logger.error("Error handling subscription.deleted", { error: err });
        }
        break;
      }

      // ============================================
      // CHARGE REFUNDED
      // ============================================
      case "charge.refunded": {
        try {
          const charge = event.data.object as Stripe.Charge;
          const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
          
          if (!customerId) break;
          
          const userId = await getUserIdByCustomerId(customerId);
          if (!userId) break;
          
          // Log refund
          await db.collection("refunds").add({
            chargeId: charge.id,
            userId,
            customerId,
            amountRefunded: charge.amount_refunded,
            originalAmount: charge.amount,
            currency: charge.currency,
            isFullRefund: charge.amount_refunded === charge.amount,
            createdAt: new Date(),
          });
          
          // Send refund email
          const userDoc = await db.collection("users").doc(userId).get();
          const userData = userDoc.data();
          
          if (userData?.email) {
            const refundAmount = ((charge.amount_refunded || 0) / 100).toFixed(2);
            
            await sendEmail({
              to: userData.email,
              subject: "💸 Refund Processed",
              content: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #0891B2;">💸 Refund Processed</h1>
                  <p>Hi ${userData.name || "there"},</p>
                  <p>We've processed a refund of <strong>$${refundAmount}</strong> to your original payment method.</p>
                  <p style="color: #666;">The refund should appear in your account within 5-10 business days.</p>
                </div>
              `,
            });
          }
          
          logger.info("💸 Handled charge.refunded", { chargeId: charge.id, userId, amount: charge.amount_refunded });
        } catch (err) {
          logger.error("Error handling charge.refunded", { error: err });
        }
        break;
      }

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    logger.error("Error handling Stripe webhook", { error });
    res.status(500).send("Internal Server Error");
  }
});

// ============================================
// TRACK PAGE USAGE
// ============================================

export const trackPageUsage = onCall(
  {
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const { pageCount, isNewDocument = false } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!pageCount || pageCount < 1) {
      throw new HttpsError("invalid-argument", "Invalid page count");
    }
    
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.subscription) {
      throw new HttpsError("failed-precondition", "No subscription found");
    }
    
    const subscription = userData.subscription;
    const currentPagesUsed = subscription.pagesUsed || subscription.pagesUsedThisMonth || 0;
    const currentDocsUsed = subscription.documentsUsed || 0;
    const newPagesUsed = currentPagesUsed + pageCount;
    const newDocsUsed = isNewDocument ? currentDocsUsed + 1 : currentDocsUsed;
    const pagesLimit = subscription.pagesLimit || 50;
    const documentsLimit = subscription.documentsLimit || 5;
    const planId = subscription.planId || "free";
    
    // Check if user is on free trial and exceeding limits
    const isTrialOrFree = planId === "free" || subscription.status === "trialing";
    const isPayAsYouGo = planId === "starter";
    
    if (isTrialOrFree) {
      // Check trial expiration
      const trialEnd = subscription.trialEnd?.toDate ? subscription.trialEnd.toDate() : subscription.trialEnd;
      if (trialEnd && new Date() > new Date(trialEnd)) {
        throw new HttpsError(
          "resource-exhausted",
          "Your free trial has expired. Please upgrade to continue processing documents."
        );
      }
      
      // Check document limit
      if (documentsLimit > 0 && isNewDocument && newDocsUsed > documentsLimit) {
        throw new HttpsError(
          "resource-exhausted",
          `Free trial limit of ${documentsLimit} documents exceeded. Please upgrade to continue.`
        );
      }
      
      // Check page limit
      if (newPagesUsed > pagesLimit) {
        throw new HttpsError(
          "resource-exhausted",
          `Free trial limit of ${pagesLimit} pages exceeded. Please upgrade to continue.`
        );
      }
    }
    
    // ============================================
    // REPORT USAGE TO STRIPE FOR PAY-AS-YOU-GO
    // Uses Stripe Billing Meters (required since 2025-03-31)
    // ============================================
    if (isPayAsYouGo && userData.stripeCustomerId) {
      try {
        const stripe = new Stripe(stripeSecretKey.value());
        
        // Report usage to Stripe via Billing Meter Events
        // Meter event_name must match what was set when creating the meter
        await stripe.billing.meterEvents.create({
          event_name: "page_processed", // Must match the meter's event_name
          payload: {
            stripe_customer_id: userData.stripeCustomerId,
            value: String(pageCount),
          },
        });
        
        logger.info("📊 Reported usage to Stripe Billing Meter", { 
          userId, 
          customerId: userData.stripeCustomerId,
          pageCount, 
          totalPages: newPagesUsed,
        });
      } catch (stripeErr: any) {
        logger.error("Failed to report usage to Stripe Billing Meter", { 
          error: stripeErr.message, 
          userId,
          customerId: userData.stripeCustomerId,
        });
        // Don't fail the request - still track locally
      }
    }
    
    // Update usage locally
    const updateData: Record<string, any> = {
      "subscription.pagesUsed": newPagesUsed,
      updatedAt: new Date(),
    };
    
    if (isNewDocument) {
      updateData["subscription.documentsUsed"] = newDocsUsed;
    }
    
    await db.collection("users").doc(userId).update(updateData);
    
    // Track overage for paid plans (not Pay-as-you-go - that's all usage-based)
    let overagePages = 0;
    let estimatedOverageCharge = 0;
    
    if (!isPayAsYouGo && newPagesUsed > pagesLimit && !isTrialOrFree) {
      overagePages = newPagesUsed - pagesLimit;
      const overageRate = subscription.overagePerPage || 0.10;
      estimatedOverageCharge = overagePages * overageRate;
      
      await db.collection("users").doc(userId).update({
        "subscription.overagePages": overagePages,
        "subscription.estimatedOverageCharge": estimatedOverageCharge,
      });
    }
    
    // For Pay-as-you-go, calculate estimated charge based on all pages
    if (isPayAsYouGo) {
      estimatedOverageCharge = newPagesUsed * 0.05; // $0.05 per page
    }
    
    return {
      pagesUsed: newPagesUsed,
      pagesLimit: isPayAsYouGo ? -1 : pagesLimit, // -1 = unlimited for Pay-as-you-go
      pagesRemaining: isPayAsYouGo ? -1 : Math.max(0, pagesLimit - newPagesUsed),
      documentsUsed: newDocsUsed,
      documentsLimit: isPayAsYouGo ? -1 : documentsLimit,
      documentsRemaining: isPayAsYouGo ? -1 : (documentsLimit > 0 ? Math.max(0, documentsLimit - newDocsUsed) : -1),
      isOverLimit: !isPayAsYouGo && (newPagesUsed > pagesLimit || (documentsLimit > 0 && newDocsUsed > documentsLimit)),
      overagePages,
      estimatedOverageCharge,
      isPayAsYouGo,
    };
  }
);

// ============================================
// GET SUBSCRIPTION STATUS
// ============================================

export const getSubscriptionStatus = onCall(async (request) => {
  const userId = request.auth?.uid;
  
  if (!userId) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }
  
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.data();
  
  if (!userData?.subscription) {
    return {
      status: "trialing",
      plan: "free",
      planId: "free",
      pagesUsed: 0,
      pagesLimit: 50,
      pagesRemaining: 50,
      documentsUsed: 0,
      documentsLimit: 5,
      documentsRemaining: 5,
      overagePages: 0,
      estimatedOverageCharge: 0,
      isTrialExpired: false,
    };
  }
  
  const subscription = userData.subscription;
  const pagesUsed = subscription.pagesUsed || subscription.pagesUsedThisMonth || 0;
  const pagesLimit = subscription.pagesLimit || 50;
  const documentsUsed = subscription.documentsUsed || 0;
  const documentsLimit = subscription.documentsLimit || 5;
  
  // Check if trial has expired
  let isTrialExpired = false;
  const trialEnd = subscription.trialEnd?.toDate ? subscription.trialEnd.toDate() : subscription.trialEnd;
  if (subscription.status === "trialing" && trialEnd && new Date() > new Date(trialEnd)) {
    isTrialExpired = true;
  }
  
  return {
    status: subscription.status,
    plan: subscription.planId || "free",
    planId: subscription.planId || "free",
    pagesUsed,
    pagesLimit,
    pagesRemaining: Math.max(0, pagesLimit - pagesUsed),
    documentsUsed,
    documentsLimit,
    documentsRemaining: documentsLimit > 0 ? Math.max(0, documentsLimit - documentsUsed) : -1,
    overagePages: subscription.overagePages || 0,
    estimatedOverageCharge: subscription.estimatedOverageCharge || 0,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
    trialEnd: subscription.trialEnd,
    trialStart: subscription.trialStart,
    isTrialExpired,
  };
});

// ============================================
// GET BILLING DETAILS (payment method, address, preferences)
// ============================================

export const getBillingDetails = onCall(
  {
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.stripeCustomerId) {
      return {
        paymentMethod: null,
        billingAddress: null,
        emailReceipts: true,
      };
    }
    
    const stripe = new Stripe(stripeSecretKey.value());
    
    try {
      // Fetch customer from Stripe
      const customer = await stripe.customers.retrieve(userData.stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"],
      }) as Stripe.Customer;
      
      if (customer.deleted) {
        return {
          paymentMethod: null,
          billingAddress: null,
          emailReceipts: true,
        };
      }
      
      // Extract payment method details
      let paymentMethod = null;
      const defaultPM = customer.invoice_settings?.default_payment_method;
      
      if (defaultPM && typeof defaultPM !== "string") {
        const pm = defaultPM as Stripe.PaymentMethod;
        if (pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          };
        }
      } else if (typeof defaultPM === "string") {
        // If it's just an ID, fetch the payment method
        try {
          const pm = await stripe.paymentMethods.retrieve(defaultPM);
          if (pm.card) {
            paymentMethod = {
              id: pm.id,
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        } catch (e) {
          logger.warn("Could not fetch payment method", { pmId: defaultPM });
        }
      }
      
      // If no default, try to get from subscriptions
      if (!paymentMethod && userData.stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId, {
            expand: ["default_payment_method"],
          });
          const subPM = sub.default_payment_method;
          if (subPM && typeof subPM !== "string" && (subPM as Stripe.PaymentMethod).card) {
            const pm = subPM as Stripe.PaymentMethod;
            paymentMethod = {
              id: pm.id,
              brand: pm.card!.brand,
              last4: pm.card!.last4,
              expMonth: pm.card!.exp_month,
              expYear: pm.card!.exp_year,
            };
          }
        } catch (e) {
          logger.warn("Could not fetch subscription payment method");
        }
      }
      
      // Extract billing address
      const billingAddress = customer.address ? {
        line1: customer.address.line1 || "",
        line2: customer.address.line2 || "",
        city: customer.address.city || "",
        state: customer.address.state || "",
        postalCode: customer.address.postal_code || "",
        country: customer.address.country || "",
      } : null;
      
      // Email receipt preference (stored in metadata or default to true)
      const emailReceipts = customer.metadata?.emailReceipts !== "false";
      
      return {
        paymentMethod,
        billingAddress,
        emailReceipts,
        email: customer.email,
        name: customer.name,
      };
    } catch (error: any) {
      logger.error("Error fetching billing details", { error: error.message, userId });
      throw new HttpsError("internal", "Failed to fetch billing details");
    }
  }
);

// ============================================
// UPDATE BILLING PREFERENCES (email receipts)
// ============================================

export const updateBillingPreferences = onCall(
  {
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const { emailReceipts } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.stripeCustomerId) {
      throw new HttpsError("failed-precondition", "No billing account found");
    }
    
    const stripe = new Stripe(stripeSecretKey.value());
    
    try {
      await stripe.customers.update(userData.stripeCustomerId, {
        metadata: {
          emailReceipts: emailReceipts ? "true" : "false",
        },
      });
      
      logger.info("Updated billing preferences", { userId, emailReceipts });
      
      return { success: true };
    } catch (error: any) {
      logger.error("Error updating billing preferences", { error: error.message, userId });
      throw new HttpsError("internal", "Failed to update preferences");
    }
  }
);

// ============================================
// UPDATE BILLING ADDRESS
// ============================================

export const updateBillingAddress = onCall(
  {
    secrets: [stripeSecretKey],
  },
  async (request) => {
    const { address } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!address) {
      throw new HttpsError("invalid-argument", "Address is required");
    }
    
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData?.stripeCustomerId) {
      throw new HttpsError("failed-precondition", "No billing account found");
    }
    
    const stripe = new Stripe(stripeSecretKey.value());
    
    try {
      await stripe.customers.update(userData.stripeCustomerId, {
        address: {
          line1: address.line1 || "",
          line2: address.line2 || "",
          city: address.city || "",
          state: address.state || "",
          postal_code: address.postalCode || "",
          country: address.country || "",
        },
      });
      
      logger.info("Updated billing address", { userId });
      
      return { success: true };
    } catch (error: any) {
      logger.error("Error updating billing address", { error: error.message, userId });
      throw new HttpsError("internal", "Failed to update billing address");
    }
  }
);
