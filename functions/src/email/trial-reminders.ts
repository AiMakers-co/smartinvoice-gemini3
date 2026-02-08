import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "../shared/firebase";
import { sendEmail, logEmail } from "./service";

// ============================================
// TRIAL REMINDER EMAILS
// Sends reminder emails to users whose trials are ending
// ============================================

interface UserWithTrial {
  id: string;
  email: string;
  name: string;
  trialEnd: Date;
  daysRemaining: number;
  pagesUsed: number;
  pagesLimit: number;
}

/**
 * Generate trial reminder email HTML
 */
function generateTrialReminderEmail(user: UserWithTrial, brandName: string = "SmartInvoice"): string {
  const urgency = user.daysRemaining <= 1 ? "urgent" : user.daysRemaining <= 3 ? "warning" : "info";
  const usagePercent = Math.round((user.pagesUsed / user.pagesLimit) * 100);
  
  const ctaColor = urgency === "urgent" ? "#dc2626" : urgency === "warning" ? "#d97706" : "#2563eb";
  const headerBg = urgency === "urgent" ? "#fef2f2" : urgency === "warning" ? "#fffbeb" : "#eff6ff";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${user.daysRemaining === 0 ? "Your trial ends today" : `${user.daysRemaining} day${user.daysRemaining !== 1 ? "s" : ""} left in your trial`}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${headerBg}; padding: 24px 32px; text-align: center;">
              <div style="display: inline-block; background-color: ${ctaColor}; color: white; font-size: 28px; font-weight: bold; width: 56px; height: 56px; line-height: 56px; border-radius: 12px; margin-bottom: 12px;">
                ${user.daysRemaining}
              </div>
              <h1 style="margin: 0; font-size: 20px; color: #1e293b;">
                ${user.daysRemaining === 0 
                  ? "Your trial ends today!"
                  : user.daysRemaining === 1 
                    ? "Your trial ends tomorrow!"
                    : `${user.daysRemaining} days left in your ${brandName} trial`
                }
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Hi ${user.name || "there"},
              </p>
              
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                ${user.daysRemaining === 0
                  ? `This is your final reminder - your ${brandName} trial expires today. Subscribe now to continue processing bank statements and invoices without interruption.`
                  : user.daysRemaining <= 3
                    ? `Your ${brandName} trial is ending soon. Don't lose access to AI-powered document processing - subscribe now to continue.`
                    : `Just a friendly reminder that your ${brandName} trial will end in ${user.daysRemaining} days. Consider subscribing to keep your workflow uninterrupted.`
                }
              </p>
              
              <!-- Usage Stats -->
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                  Your trial usage
                </p>
                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #1e293b;">
                  ${user.pagesUsed} pages processed
                </p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">
                  ${usagePercent}% of your ${user.pagesLimit} page trial limit
                </p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <a href="https://app.smartinvoice.ai/settings?tab=billing" 
                       style="display: inline-block; background-color: ${ctaColor}; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Subscribe Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; text-align: center;">
                Plans start from just $0.05/page
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                ${brandName} • AI-Powered Document Processing<br>
                <a href="https://smartinvoice.ai/unsubscribe" style="color: #94a3b8;">Unsubscribe from reminders</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Get users with trials ending in X days
 */
async function getUsersWithTrialEnding(daysFromNow: number): Promise<UserWithTrial[]> {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysFromNow);
  
  // Set to start of day
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Set to end of day
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  try {
    const usersSnapshot = await db.collection("users")
      .where("subscription.status", "==", "trialing")
      .where("subscription.trialEnd", ">=", startOfDay)
      .where("subscription.trialEnd", "<=", endOfDay)
      .get();
    
    return usersSnapshot.docs.map(doc => {
      const data = doc.data();
      const trialEnd = data.subscription?.trialEnd?.toDate?.() || new Date();
      
      return {
        id: doc.id,
        email: data.email,
        name: data.name || data.displayName || "",
        trialEnd,
        daysRemaining: Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
        pagesUsed: data.subscription?.pagesUsedThisMonth || 0,
        pagesLimit: data.subscription?.pagesLimit || 50,
      };
    });
  } catch (error) {
    logger.error("Error fetching users with trial ending:", { daysFromNow, error });
    return [];
  }
}

/**
 * Check if reminder was already sent
 */
async function wasReminderAlreadySent(userId: string, reminderType: string): Promise<boolean> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const logsSnapshot = await db.collection("email_logs")
      .where("userId", "==", userId)
      .where("type", "==", `trial_reminder_${reminderType}`)
      .where("sentAt", ">=", today)
      .limit(1)
      .get();
    
    return !logsSnapshot.empty;
  } catch (error) {
    logger.error("Error checking reminder status:", { userId, reminderType, error });
    return false; // Default to sending if we can't check
  }
}

/**
 * Send trial reminder to a single user
 */
async function sendTrialReminder(user: UserWithTrial, reminderType: string): Promise<boolean> {
  // Check if already sent today
  const alreadySent = await wasReminderAlreadySent(user.id, reminderType);
  if (alreadySent) {
    logger.info(`Trial reminder already sent to ${user.email} for ${reminderType}`);
    return false;
  }
  
  const subject = user.daysRemaining === 0
    ? "⚠️ Your SmartInvoice trial ends today"
    : user.daysRemaining === 1
      ? "⚡ Your SmartInvoice trial ends tomorrow"
      : `${user.daysRemaining} days left in your SmartInvoice trial`;
  
  const content = generateTrialReminderEmail(user);
  
  const sent = await sendEmail({
    to: user.email,
    subject,
    content,
  });
  
  await logEmail({
    to: user.email,
    subject,
    type: `trial_reminder_${reminderType}`,
    userId: user.id,
    status: sent ? "sent" : "failed",
    metadata: {
      daysRemaining: user.daysRemaining,
      trialEnd: user.trialEnd.toISOString(),
      pagesUsed: user.pagesUsed,
    },
    trigger: "scheduled",
  });
  
  return sent;
}

/**
 * Scheduled function to check and send trial reminder emails
 * Runs daily at 9 AM UTC
 */
export const checkTrialReminders = onSchedule(
  {
    schedule: "0 9 * * *", // Every day at 9:00 AM UTC
    timeZone: "UTC",
    retryCount: 3,
  },
  async () => {
    logger.info("🕐 Starting trial reminder check...");
    
    const reminderDays = [7, 3, 1, 0]; // Days before trial end to send reminders
    const results = {
      checked: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    };
    
    for (const days of reminderDays) {
      const users = await getUsersWithTrialEnding(days);
      results.checked += users.length;
      
      for (const user of users) {
        const reminderType = days === 0 ? "final" : days === 1 ? "1day" : days === 3 ? "3day" : "7day";
        
        try {
          const sent = await sendTrialReminder(user, reminderType);
          if (sent) {
            results.sent++;
            logger.info(`✅ Sent ${reminderType} reminder to ${user.email}`);
          } else {
            results.skipped++;
          }
        } catch (error) {
          results.failed++;
          logger.error(`❌ Failed to send reminder to ${user.email}:`, { error });
        }
      }
    }
    
    logger.info("📊 Trial reminder check complete:", results);
  }
);

/**
 * Manual trigger for testing (callable function)
 */
export const triggerTrialReminders = async () => {
  logger.info("🔧 Manual trial reminder trigger...");
  
  // Get all trialing users
  const usersSnapshot = await db.collection("users")
    .where("subscription.status", "==", "trialing")
    .get();
  
  const results: Array<{ email: string; daysRemaining: number; status: string }> = [];
  const now = new Date();
  
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const trialEnd = data.subscription?.trialEnd?.toDate?.() || new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    results.push({
      email: data.email,
      daysRemaining,
      status: daysRemaining <= 7 ? "would_send_reminder" : "trial_ok",
    });
  }
  
  return results;
};
