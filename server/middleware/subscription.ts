import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Middleware que implementa el bloqueo de suscripciones según los 4 escenarios:
 * 1. Sin método de pago durante trial → continúa hasta fin trial
 * 2. Con método de pago antes del trial → acceso permitido  
 * 3. Con método de pago después del trial → acceso permitido
 * 4. Método de pago eliminado ANTES de fin trial → regresa a estado trial
 * Solo BLOQUEO TOTAL: Sin método de pago DESPUÉS del trial expirado
 */
export async function requireActiveSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    // Obtener estado de suscripción
    const result = await db.execute(sql`
      SELECT 
        trial_end_date,
        is_trial_active,
        status,
        stripe_customer_id,
        stripe_subscription_id
      FROM subscriptions 
      WHERE company_id = ${companyId}
    `);
    
    const subscription = result.rows[0];
    if (!subscription) {
      return res.status(403).json({ 
        message: 'Suscripción no encontrada',
        blocked: true,
        reason: 'no_subscription'
      });
    }

    const now = new Date();
    const trialEndDate = new Date(subscription.trial_end_date);
    const isTrialExpired = now > trialEndDate;
    const hasPaymentMethod = !!subscription.stripe_customer_id;

    // ÚNICO ESCENARIO DE BLOQUEO: Sin método de pago después del trial expirado
    if (isTrialExpired && !hasPaymentMethod) {
      // Auto-bloquear en base de datos si no está ya bloqueado
      if (subscription.status !== 'blocked') {
        await db.execute(sql`
          UPDATE subscriptions 
          SET status = 'blocked', is_trial_active = false 
          WHERE company_id = ${companyId}
        `);
      }

      return res.status(403).json({
        message: 'Cuenta bloqueada: Añade un método de pago para continuar usando Oficaz',
        blocked: true,
        reason: 'no_payment_method_after_trial',
        trialEndDate: subscription.trial_end_date
      });
    }

    // Escenario 4: Sin método de pago ANTES de expirar trial = REACTIVAR TRIAL
    if (!isTrialExpired && !hasPaymentMethod) {
      // Si la suscripción está marcada como 'active' pero no hay método de pago
      // y aún no ha expirado el trial, reactivar el trial
      if (subscription.status === 'active' && !subscription.is_trial_active) {
        await db.execute(sql`
          UPDATE subscriptions 
          SET status = 'trial', is_trial_active = true 
          WHERE company_id = ${companyId}
        `);
      }
      
      // Continuar normalmente - se mostrará como trial en frontend
      return next();
    }

    // Con método de pago (escenarios 2 y 3): permitir acceso
    if (hasPaymentMethod) {
      return next();
    }

    // Cualquier otro caso de bloqueo
    if (subscription.status === 'blocked') {
      return res.status(403).json({
        message: 'Cuenta bloqueada: Contacta con soporte para reactivar tu suscripción',
        blocked: true,
        reason: 'account_blocked'
      });
    }

    // Por defecto, permitir acceso
    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/**
 * Lista blanca de rutas que NO requieren suscripción activa
 */
const SUBSCRIPTION_WHITELIST = [
  '/api/auth/',
  '/api/login',
  '/api/logout',
  '/api/register',
  '/api/account/trial-status',
  '/api/account/create-setup-intent',
  '/api/account/confirm-payment-method',
  '/api/subscription-plans',
  '/api/super-admin/',
  // Rutas estáticas
  '/assets/',
  '/favicon.ico'
];

/**
 * Verifica si una ruta está en la lista blanca
 */
export function isWhitelistedRoute(path: string): boolean {
  return SUBSCRIPTION_WHITELIST.some(whitelisted => path.startsWith(whitelisted));
}