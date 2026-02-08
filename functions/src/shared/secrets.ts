import { defineSecret } from "firebase-functions/params";

// ============================================
// SHARED SECRETS
// Define all secrets in one place
// ============================================

export const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
export const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// Algolia
export const algoliaAdminKey = defineSecret("ALGOLIA_ADMIN_KEY");

