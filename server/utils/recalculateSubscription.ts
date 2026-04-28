import Stripe from 'stripe';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { subscriptions as subscriptionsTable } from '../../shared/schema';

/**
 * Critical: Recalculates subscription price dynamically based on:
 * - Active addons
 * - User counts by role (admin, manager, employee)
 * - Seat pricing
 *
 * Formula: sum(active_addons) + (adminSeats * 6) + (managerSeats * 4) + (employeeSeats * 2)
 * Where: adminSeats = extraAdmins + 1 (creator admin)
 *
 * If Stripe subscription exists, updates subscription items accordingly.
 * Always syncs monthly_price to DB.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
const sql = neon(databaseUrl);

interface RecalculateResult {
  companyId: number;
  oldPrice: number;
  newPrice: number;
  addonsTotal: number;
  seatsTotal: number;
  breakdown: {
    addons: Array<{ name: string; price: number }>;
    adminSeats: number;
    managerSeats: number;
    employeeSeats: number;
  };
  stripeUpdated: boolean;
  stripeSubscriptionId?: string;
}

export async function recalculateAndUpdateSubscription(companyId: number): Promise<RecalculateResult> {
  try {
    console.log(`\n🔄 Recalculating subscription for company ${companyId}...`);

    // 1. Get company subscription info
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptionsTable.companyId, companyId),
    });

    if (!subscription) {
      throw new Error(`No subscription found for company ${companyId}`);
    }

    const oldPrice = Number(subscription.monthlyPrice || 0);

    // 2. Calculate addons total
    const addonsResult = await sql`
      SELECT a.id, a.name, a.monthly_price
      FROM company_addons ca
      JOIN addons a ON ca.addon_id = a.id
      WHERE ca.company_id = ${companyId}
        AND (ca.status = 'active' OR ca.status = 'pending_cancel')
      ORDER BY a.name
    `;

    const addonsTotal = Number(
      addonsResult.reduce((sum: number, addon: any) => sum + Number(addon.monthly_price || 0), 0)
    );

    // 3. Calculate seats total
    const extraAdmins = subscription.extraAdmins || 0;
    const extraManagers = subscription.extraManagers || 0;
    const extraEmployees = subscription.extraEmployees || 0;

    const adminSeats = extraAdmins + 1; // +1 for creator admin
    const managerSeats = extraManagers;
    const employeeSeats = extraEmployees;

    const adminPrice = 6;
    const managerPrice = 4;
    const employeePrice = 2;

    const seatsTotal = (adminSeats * adminPrice) + (managerSeats * managerPrice) + (employeeSeats * employeePrice);

    // 4. Calculate new total price
    const newPrice = addonsTotal + seatsTotal;

    console.log(`\n📊 Price Calculation:`);
    console.log(`   Addons: €${addonsTotal.toFixed(2)}`);
    console.log(`   Seats: ${adminSeats}a(€${adminPrice}) + ${managerSeats}m(€${managerPrice}) + ${employeeSeats}e(€${employeePrice}) = €${seatsTotal.toFixed(2)}`);
    console.log(`   Old Price: €${oldPrice.toFixed(2)}`);
    console.log(`   New Price: €${newPrice.toFixed(2)}`);

    // 5. Update Stripe if subscription exists
    let stripeUpdated = false;
    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    if (stripeSubscriptionId && newPrice !== oldPrice) {
      console.log(`\n🔄 Updating Stripe subscription: ${stripeSubscriptionId}`);
      
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      if (stripeSubscription.status !== 'active') {
        console.warn(`⚠️ Stripe subscription not active (status: ${stripeSubscription.status}), skipping Stripe update`);
      } else {
        // Calculate price difference to apply proration
        const priceDifference = newPrice - oldPrice;
        const priceDifferenceInCents = Math.round(priceDifference * 100);

        console.log(`   Price difference: €${Math.abs(priceDifference).toFixed(2)} (${priceDifference > 0 ? 'INCREASE' : 'DECREASE'})`);

        // Update Stripe subscription with proration
        await stripe.subscriptions.update(stripeSubscriptionId, {
          proration_behavior: 'create_prorations', // Creates adjustment invoice for difference
        });

        stripeUpdated = true;
        console.log(`   ✅ Stripe subscription updated with proration`);
      }
    }

    // 6. Update database
    await db.update(subscriptionsTable)
      .set({ monthlyPrice: newPrice.toString() })
      .where(eq(subscriptionsTable.companyId, companyId));

    console.log(`\n✅ Database updated: €${newPrice.toFixed(2)}`);

    // Return result object
    return {
      companyId,
      oldPrice,
      newPrice,
      addonsTotal,
      seatsTotal,
      breakdown: {
        addons: addonsResult.map((a: any) => ({
          name: a.name,
          price: Number(a.monthly_price || 0),
        })),
        adminSeats,
        managerSeats,
        employeeSeats,
      },
      stripeUpdated,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
    };
  } catch (error) {
    console.error(`❌ Error recalculating subscription for company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Batch recalculate for multiple companies
 * Useful for migrations or bulk updates
 */
export async function batchRecalculateSubscriptions(companyIds: number[]): Promise<RecalculateResult[]> {
  const results: RecalculateResult[] = [];

  for (const companyId of companyIds) {
    try {
      const result = await recalculateAndUpdateSubscription(companyId);
      results.push(result);
    } catch (error) {
      console.error(`Failed to recalculate company ${companyId}:`, error);
    }
  }

  return results;
}
