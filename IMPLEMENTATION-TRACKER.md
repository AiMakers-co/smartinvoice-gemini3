# Implementation Tracker: Sign Up, Teams, Packages & Stripe Fixes

**Started:** January 8, 2026
**Status:** ✅ Code Complete - Ready for Testing

---

## Progress Overview

| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| 1.1 | Migrate Stripe customers | ✅ Complete | 6 users migrated |
| 1.2 | Fix billing page data source | ✅ Complete | Reads from user.subscription |
| 1.3 | Store invoices in user subcollection | ✅ Complete | Webhook updated |
| 1.4 | Test checkout flow | 🔲 Pending | Manual testing required |
| 2.1 | Simplify team page | ✅ Complete | Shows upgrade prompt for free users |
| 3.2 | Handle checkout intent after login | ✅ Complete | Already implemented in layout |
| 4.1 | Tighten Firestore rules | ✅ Complete | User-scoped security |
| 4.2 | Add usage enforcement | ✅ Complete | Upload page checks limits |
| 4.3 | Create subscription hook | ✅ Complete | useSubscription hook created |

**Legend:** ✅ Complete | ⏳ In Progress | 🔲 Pending | ❌ Blocked

---

## Phase 1: Fix Stripe Integration

### 1.1 Migrate Stripe Customers for Existing Users

**Status:** ⏳ In Progress

**Problem:** 
- `createStripeCustomer` trigger only fires on NEW user creation
- Existing 6 users have no `stripeCustomerId`

**Solution:** 
- Created migration script: `scripts/migrate-stripe-customers.ts`

**Files Changed:**
- `scripts/migrate-stripe-customers.ts` (NEW)

**Verification:**
- [ ] Run script successfully
- [ ] All users have `stripeCustomerId`
- [ ] All users have `subscription.status: "free"`

---

### 1.2 Fix Billing Page Data Source

**Status:** 🔲 Pending

**Problem:**
- Billing page queries `organisations/{orgId}/subscriptions` 
- But webhook writes to `users/{userId}.subscription`
- No users have `orgId`

**Solution:**
- Update billing page to read from user document directly
- Use `getSubscriptionStatus` function for usage data

**Files Changed:**
- `src/app/(dashboard)/settings/billing/page.tsx` (MODIFIED)

**Verification:**
- [ ] Billing page shows correct plan
- [ ] Usage stats display correctly
- [ ] Invoices load (after 1.3)

---

### 1.3 Store Invoices in User Subcollection

**Status:** 🔲 Pending

**Problem:**
- Invoices aren't stored anywhere the frontend can access

**Solution:**
- On `invoice.payment_succeeded`, store to `users/{userId}/invoices/{invoiceId}`

**Files Changed:**
- `functions/src/stripe/index.ts` (MODIFIED)

**Verification:**
- [ ] Invoice appears in Firestore after payment
- [ ] Billing page shows invoice history

---

### 1.4 Test End-to-End Checkout Flow

**Status:** 🔲 Pending

**Test Cases:**
- [ ] New user signup → Stripe customer created
- [ ] Click "Start Trial" on Pro → Checkout opens
- [ ] Complete checkout → Webhook fires
- [ ] User subscription updated
- [ ] Billing page shows Pro plan
- [ ] Stripe portal opens and works

---

## Phase 2: Fix Team Management

### 2.1 Simplify Team Page

**Status:** 🔲 Pending

**Problem:**
- Team page writes to non-existent `team_members` collection
- No invitation flow
- No organization structure

**Solution:**
- Simplify to show "upgrade for team features" CTA
- Remove broken invitation system
- Show team features based on plan

**Files Changed:**
- `src/app/(dashboard)/team/page.tsx` (MODIFIED)

**Verification:**
- [ ] Free/Pro users see upgrade prompt
- [ ] Team/Business users see team management
- [ ] No errors in console

---

## Phase 3: Improve Sign Up Flow

### 3.2 Handle Checkout Intent After Login

**Status:** 🔲 Pending

**Problem:**
- User clicks "Start Trial" before logging in
- Intent saved to sessionStorage
- Nothing processes it after login

**Solution:**
- Check for `checkoutIntent` in dashboard layout
- Trigger checkout if found

**Files Changed:**
- `src/app/(dashboard)/layout.tsx` (MODIFIED)

**Verification:**
- [ ] Click Pro on pricing page (not logged in)
- [ ] Complete signup
- [ ] Automatically redirected to checkout

---

## Phase 4: Security & Polish

### 4.1 Tighten Firestore Rules

**Status:** 🔲 Pending

**Problem:**
- Current rules allow any authenticated user to read/write anything

**Solution:**
- Restrict to user's own data only

**Files Changed:**
- `firestore.rules` (MODIFIED)

**Verification:**
- [ ] User can read/write own data
- [ ] User cannot read/write other users' data
- [ ] All features still work

---

### 4.2 Add Usage Enforcement

**Status:** 🔲 Pending

**Problem:**
- Free tier limit (50 pages) not enforced on frontend

**Solution:**
- Check limit before upload
- Show upgrade modal if exceeded

**Files Changed:**
- `src/app/(dashboard)/upload/page.tsx` (MODIFIED)

**Verification:**
- [ ] Free user with 50+ pages sees upgrade prompt
- [ ] Paid users can continue uploading

---

### 4.3 Create Subscription Hook

**Status:** 🔲 Pending

**Solution:**
- Create `useSubscription` hook for feature gating

**Files Changed:**
- `src/hooks/use-subscription.ts` (NEW)

**Verification:**
- [ ] Hook returns correct plan
- [ ] `canUseFeature()` works correctly

---

## Completed Changes Log

| Date | Task | Files | Notes |
|------|------|-------|-------|
| Jan 8 | 1.1 Migrate Stripe customers | `scripts/migrate-stripe-customers.ts` | Created 6 Stripe customers |
| Jan 8 | 1.2 Fix billing page | `src/app/(dashboard)/settings/billing/page.tsx` | Reads from user.subscription |
| Jan 8 | 1.3 Store invoices | `functions/src/stripe/index.ts` | Added invoice subcollection |
| Jan 8 | 2.1 Simplify team page | `src/app/(dashboard)/team/page.tsx` | Plan-based UI |
| Jan 8 | 4.1 Firestore rules | `firestore.rules` | User-scoped security |
| Jan 8 | 4.2 Usage enforcement | `src/app/(dashboard)/upload/page.tsx` | Limit check + modal |
| Jan 8 | 4.3 Subscription hook | `src/hooks/use-subscription.ts` | New hook created |

---

## Issues Encountered

| Issue | Resolution | Date |
|-------|------------|------|
| | | |

