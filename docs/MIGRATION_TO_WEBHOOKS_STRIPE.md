# Migration from Polling to Event-Driven Architecture

## ✅ COMPLETED: Event-Driven Reminders (No Polling)

**Status:** IMPLEMENTED
- ✅ Added `scheduledReminderTimeouts` Map to track setTimeout IDs
- ✅ Implemented `scheduleReminder()` function (like alarms)
- ✅ Implemented `loadAndScheduleAllReminders()` on startup
- ✅ Created `reloadReminders()` export for CRUD operations
- ✅ Integrated with POST/PATCH reminder endpoints
- ✅ Removed 5-min cron job for reminders

**Benefits:**
- ✅ **Zero polling overhead** (no DB queries every 5 minutes)
- ✅ **Exact timing** (notifications sent precisely at `reminderDate`)
- ✅ **Scalable** to millions of reminders (memory efficient)
- ✅ **Matches alarm architecture** (consistent codebase)

**Implementation:**
```typescript
// server/pushNotificationScheduler.ts
function scheduleReminder(reminder) {
  const delayMs = new Date(reminder.reminderDate).getTime() - getSpainTime().getTime();
  if (delayMs > 0) {
    const timeout = setTimeout(async () => {
      await sendReminderNotification(reminder);
      await markReminderAsNotified(reminder.id);
    }, delayMs);
    scheduledReminderTimeouts.set(reminder.id, timeout);
  }
}

// Reloads on create/update/delete
export async function reloadReminders() {
  scheduledReminderTimeouts.forEach(clearTimeout);
  scheduledReminderTimeouts.clear();
  await loadAndScheduleAllReminders();
}
```

## ✅ COMPLETED: Stripe Webhooks for Trial Expiration

**Status:** IMPLEMENTED (endpoint ready, awaiting Stripe configuration)
- ✅ Created `/api/webhooks/stripe` endpoint with signature verification
- ✅ Handles `customer.subscription.trial_will_end`
- ✅ Handles `customer.subscription.updated`
- ✅ Handles `invoice.payment_failed`
- ✅ Handles `customer.subscription.deleted`
- ✅ Uses `express.raw()` middleware for signature verification

**Endpoint Location:** [server/routes.ts](server/routes.ts#L1645-L1777)

## 🔧 REQUIRED: Configure Stripe Webhook (User Action Required)

### Step 1: Register Webhook in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://oficaz.es/api/webhooks/stripe` (or your production domain)
4. Select events to listen for:
   - ✅ `customer.subscription.trial_will_end`
   - ✅ `customer.subscription.updated`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.deleted`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_...`)

### Step 2: Add to Environment Variables

```bash
# .env (add this line)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Test Webhook Locally (Optional)

Use Stripe CLI to forward webhooks to localhost:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# In another terminal, trigger test events:
stripe trigger customer.subscription.trial_will_end
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

### Step 4: Remove Trial Cron Job (After Webhook Working)

Once webhook is confirmed working in production:

```typescript
// server/pushNotificationScheduler.ts
// Comment out or remove:
// global.pushSchedulerTrialTask = cron.schedule('0 * * * *', ...)
```

**Why keep it temporarily?**
- Fallback in case webhook configuration fails
- Ensures trials still process while testing webhook
- Remove once webhook proven reliable (1-2 weeks in production)

## 📊 Current Scheduler Status

### ✅ Event-Driven (No Polling)
- **Alarms:** `setTimeout` per alarm (exact timing)
- **Reminders:** `setTimeout` per reminder (exact timing) 🆕

### ✅ Cron Jobs (Timezone-Aware)
- **Incomplete sessions:** `0 9 * * *` (daily at 9 AM Spain)
- **Deletions:** `0 2 * * *` (daily at 2 AM Spain)
- **Trials (temporary):** `0 * * * *` (hourly, until webhook configured)

### 🎯 Final State (After Webhook Configured)
- **Alarms:** Event-driven ✅
- **Reminders:** Event-driven ✅
- **Incomplete sessions:** Daily cron (9 AM) ✅
- **Deletions:** Daily cron (2 AM) ✅
- **Trials:** Stripe webhooks (instant) ✅

## 🚀 Performance Gains

### Before (Polling Era)
- Reminders: 288 checks/day (every 5 min)
- Trials: 24 checks/day (every hour)
- Incomplete: 288 checks/day (every 5 min)
- Deletions: 24 checks/day (every hour)
- **Total:** 624 polling queries/day

### After (Event-Driven + Cron + Webhooks)
- Reminders: **0 polling** (event-driven)
- Trials: **0 polling** (webhooks, after config)
- Incomplete: **1 query/day** (cron at 9 AM)
- Deletions: **1 query/day** (cron at 2 AM)
- **Total:** 2 scheduled queries/day

**Reduction:** 99.7% fewer DB queries 🎉

## 📝 Testing Checklist

- [ ] Webhook endpoint returns 200 OK for valid signatures
- [ ] Invalid signatures return 400 Bad Request
- [ ] `trial_will_end` event logs company name
- [ ] `subscription.updated` detects conversion to paid
- [ ] `payment_failed` logs company for notification
- [ ] New reminders schedule correctly
- [ ] Updated reminders reschedule correctly
- [ ] Alarms still trigger at correct times
- [ ] No duplicate notifications (hot reload protection works)

## 🔒 Security Notes

- ✅ Webhook signature verification prevents fake requests
- ✅ `express.raw()` middleware preserves signature for verification
- ✅ Logs all webhook events for audit trail
- ✅ Graceful error handling (doesn't crash server)
- ⚠️ Ensure `STRIPE_WEBHOOK_SECRET` is in production `.env`

## 📚 References

- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Subscription Lifecycle](https://stripe.com/docs/billing/subscriptions/overview)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Event Types Reference](https://stripe.com/docs/api/events/types)

---

**Last Updated:** December 16, 2025
**Status:** Event-driven reminders ✅ | Stripe webhooks ✅ | Configuration pending ⏳
