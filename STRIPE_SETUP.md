# Stripe Integration Setup

## Current Live Products (Created 2026-01-21)

| Plan | Monthly | Annual | Pages | Overage |
|------|---------|--------|-------|---------|
| **Pay-as-you-go** | $0 base + usage | — | Unlimited | $0.05/page |
| **Pro** | $49/mo | $468/yr ($39/mo) | 2,000 | $0.04/page |
| **Team** | $99/mo | $948/yr ($79/mo) | 4,000 | $0.035/page |
| **Business** | $179/mo | $1,788/yr ($149/mo) | 7,000 | $0.03/page |

## Price IDs (LIVE)

```
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_1Srw7FKb66mh5lk8PIqn28WB
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_1Srw7GKb66mh5lk8R2NKRjBS
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_1Srw7GKb66mh5lk8GYXsr03j
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_1Srw7HKb66mh5lk8KHjh4j2R
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_1Srw7HKb66mh5lk87B3FQ5py
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY=price_1Srw7IKb66mh5lk8fRpYYhxt
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY=price_1Srw7JKb66mh5lk8YXJbkfpY
```

## Stripe Billing Meter (for Pay-as-you-go)

- **Meter ID:** `mtr_61U1K4aVOKtPfLbUK41Kb66mh5lk85aa`
- **Event Name:** `page_processed`
- **Aggregation:** Sum

Usage is reported automatically via `stripe.billing.meterEvents.create()` in the `trackPageUsage` function.

## Keys & Secrets

### Public Key (in apphosting.yaml)
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SidSiKb66mh5lk8Wdfclu8X7hq0XSnDw4wNnYArFqCasQMnVs6Suz2nJVhN3O5qUNuXRATM5fl4a25tOQEPRC4m00CEOyP49r
```

### Secret Key (in Firebase Secrets)
Stored as `STRIPE_SECRET_KEY` via:
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
```

### Webhook Secret
Stored as `STRIPE_WEBHOOK_SECRET` in Firebase Secrets.
- **Signing secret:** `whsec_EIQw8rF9TIAAsLWlYrob3BDbe26EytWS`

## Webhook Configuration

**Endpoint URL:** `https://stripewebhook-nrfqyz5eeq-uc.a.run.app`

**Events to listen for:**
- `checkout.session.completed` - New subscription created
- `customer.subscription.created` - Subscription activated
- `customer.subscription.updated` - Plan changes/upgrades
- `customer.subscription.deleted` - Cancellation
- `invoice.payment_succeeded` - Successful payment
- `invoice.payment_failed` - Failed payment

## Payment Flow

### New Subscriptions
1. User clicks "Subscribe" on pricing/settings page
2. `createCheckoutSession` Firebase Function creates Stripe Checkout session
3. User completes payment on Stripe-hosted checkout
4. Webhook receives `checkout.session.completed`
5. User's Firestore document updated with subscription details

### Plan Changes (Upgrades/Downgrades)
1. User selects new plan in Settings > Billing
2. `updateSubscriptionPlan` Firebase Function called
3. Uses `stripe.subscriptions.update()` to modify existing subscription
4. Webhook receives `customer.subscription.updated`
5. User's Firestore document updated

### Pay-as-you-go Usage
1. User processes documents
2. `trackPageUsage` reports usage via `stripe.billing.meterEvents.create()`
3. Stripe accumulates usage throughout billing period
4. At end of period, customer billed for actual usage

## Running the Setup Script

If you need to create products from scratch:

```bash
STRIPE_SECRET_KEY="sk_live_xxx" npx tsx scripts/setup-stripe-products.ts
```

This will:
1. Create a Billing Meter for page usage
2. Create Pay-as-you-go product with metered price
3. Create Pro, Team, Business products with monthly/yearly prices
4. Output all price IDs to add to your config

## Testing

### Test a webhook locally
```bash
stripe listen --forward-to localhost:5001/ormandy-7ed6c/us-central1/stripeWebhook
```

### Trigger a test event
```bash
stripe trigger checkout.session.completed
```

## Troubleshooting

### Webhook signature verification failed
- Ensure `STRIPE_WEBHOOK_SECRET` is set correctly in Firebase Secrets
- Check that the webhook endpoint is using `req.rawBody` for verification
- Verify the webhook signing secret matches the endpoint

### Usage not being reported
- Check `trackPageUsage` logs in Firebase Functions
- Verify user has `stripeCustomerId` in Firestore
- Ensure the meter event_name matches (`page_processed`)
