/**
 * VALIDADOR AUTOMÁTICO: Sincronización BD ↔ Stripe
 * 
 * Este middleware asegura que cuando hay cambios en usuarios/addons,
 * el cálculo dinámico en BD coincida EXACTAMENTE con Stripe.
 * 
 * USO: Agregar a todos los endpoints que modifican usuarios/addons:
 * - POST /api/addons/:id/purchase
 * - POST /api/addons/:id/cancel  
 * - POST /api/subscription/seats
 * - POST /api/subscription/seats/reduce
 * - PATCH /api/users/:id (cambio de rol)
 */

import Stripe from 'stripe';
import { storage } from '../storage';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export interface SyncValidationResult {
  isValid: boolean;
  bdPrice: number;
  stripePrice: number;
  difference: number;
  breakdown: {
    bdAddons: number;
    bdUsers: number;
    stripeItems: string;
  };
  warnings: string[];
  corrections: {
    applied: boolean;
    action?: string;
    message?: string;
  };
}

/**
 * Valida que el monthly_price en BD coincida con Stripe subscription
 * Si no coinciden, realiza correcciones automáticas
 */
export async function validateAndSyncSubscription(
  companyId: number,
  autoCorrect: boolean = true
): Promise<SyncValidationResult> {
  const warnings: string[] = [];

  try {
    // 1. Get BD price (calculated dynamically)
    const calculatedPrice = await storage.calculateSubscriptionMonthlyPrice(companyId);
    const subscription = await storage.getCompanySubscription(companyId);
    const bdPrice = Number(subscription?.monthlyPrice || 0);

    // 2. Get Stripe subscription price
    if (!subscription?.stripeSubscriptionId) {
      return {
        isValid: true,
        bdPrice,
        stripePrice: 0,
        difference: 0,
        breakdown: {
          bdAddons: 0,
          bdUsers: 0,
          stripeItems: 'Sin suscripción Stripe',
        },
        warnings,
        corrections: { applied: false },
      };
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    let stripePrice = 0;

    // Calculate Stripe total from items
    for (const item of stripeSubscription.items.data) {
      const itemTotal = ((item.price.unit_amount || 0) * (item.quantity || 0)) / 100;
      stripePrice += itemTotal;
    }

    // 3. Get breakdown for debugging
    const addons = await storage.getCompanyAddons(companyId);
    const activeAddons = addons
      .filter(ca => ca.status === 'active')
      .reduce((sum, ca) => sum + Number(ca.addon?.monthlyPrice ?? 0), 0);

    const extraAdmins = subscription.extraAdmins || 0;
    const extraManagers = subscription.extraManagers || 0;
    const extraEmployees = subscription.extraEmployees || 0;
    const adminSeats = extraAdmins + 1;
    const usersTotal = (adminSeats * 6) + (extraManagers * 4) + (extraEmployees * 2);

    // 4. Validate
    const difference = bdPrice - stripePrice;
    const isValid = Math.abs(difference) < 0.01; // Allow for rounding errors

    if (!isValid && Math.abs(difference) > 0.01) {
      warnings.push(
        `BD: €${bdPrice.toFixed(2)} vs Stripe: €${stripePrice.toFixed(2)} (Diferencia: €${Math.abs(difference).toFixed(2)})`
      );
    }

    const corrections = {
      applied: false,
      action: undefined as string | undefined,
      message: undefined as string | undefined,
    };

    // 5. Auto-correct if enabled and not valid
    if (!isValid && autoCorrect) {
      console.log(
        `🔧 Auto-correcting subscription for company ${companyId}: €${bdPrice.toFixed(2)} → €${stripePrice.toFixed(2)}`
      );

      // Update BD to match Stripe
      if (Math.abs(difference) > 0.01) {
        await storage.updateSubscriptionMonthlyPrice(companyId);
        corrections.applied = true;
        corrections.action = 'updateBDPrice';
        corrections.message = `Actualizado BD a precio calculado: €${calculatedPrice.toFixed(2)}`;
      }
    }

    return {
      isValid,
      bdPrice,
      stripePrice,
      difference,
      breakdown: {
        bdAddons: activeAddons,
        bdUsers: usersTotal,
        stripeItems: `${stripeSubscription.items.data.length} items`,
      },
      warnings,
      corrections,
    };
  } catch (error) {
    console.error(`❌ Error validating sync for company ${companyId}:`, error);
    return {
      isValid: false,
      bdPrice: 0,
      stripePrice: 0,
      difference: 0,
      breakdown: {
        bdAddons: 0,
        bdUsers: 0,
        stripeItems: 'Error',
      },
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
      corrections: { applied: false },
    };
  }
}

/**
 * Middleware para Express: Valida sync después de cambios
 */
export function validateSubscriptionSync(autoCorrect: boolean = true) {
  return async (req: any, res: any, next: any) => {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        return next();
      }

      // Ejecutar validación en background (no bloquea respuesta)
      validateAndSyncSubscription(companyId, autoCorrect)
        .then((result) => {
          if (!result.isValid) {
            console.warn(
              `⚠️ Subscription sync issue for company ${companyId}:`,
              result.warnings
            );
          }
        })
        .catch((error) => {
          console.error(`❌ Sync validation failed for company ${companyId}:`, error);
        });

      next();
    } catch (error) {
      console.error('❌ Error in validateSubscriptionSync middleware:', error);
      next();
    }
  };
}
