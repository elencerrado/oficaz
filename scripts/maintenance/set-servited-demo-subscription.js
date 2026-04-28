import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sql = neon(process.env.DATABASE_URL);

async function setServitedDemoSubscription() {
  console.log('🧪 Activando modo demo de suscripción para Servited...');

  await sql`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS demo_mode BOOLEAN NOT NULL DEFAULT false
  `;

  const rows = await sql`
    SELECT
      c.id,
      c.name,
      c.company_alias,
      c.demo_mode,
      c.scheduled_for_deletion,
      c.deletion_scheduled_at,
      c.deletion_will_occur_at,
      s.id AS subscription_id,
      s.status,
      s.is_trial_active,
      s.stripe_customer_id,
      s.stripe_subscription_id,
      s.first_payment_date,
      s.next_payment_date
    FROM companies c
    LEFT JOIN subscriptions s ON s.company_id = c.id
    WHERE lower(c.name) = 'servited' OR lower(c.company_alias) = 'servited'
    LIMIT 1
  `;

  const servited = rows[0];
  if (!servited) {
    throw new Error('Empresa Servited no encontrada');
  }

  console.log('Estado actual de Servited:');
  console.log(JSON.stringify(servited, null, 2));

  if (!servited.subscription_id) {
    throw new Error('Servited no tiene fila de suscripción');
  }

  if (servited.stripe_subscription_id) {
    throw new Error(
      `Servited tiene una suscripción real en Stripe (${servited.stripe_subscription_id}). No se aplicó el modo demo para evitar dejar cobros reales inconsistentes.`,
    );
  }

  await sql`
    UPDATE companies
    SET
      demo_mode = true,
      scheduled_for_deletion = false,
      deletion_scheduled_at = NULL,
      deletion_will_occur_at = NULL,
      updated_at = now()
    WHERE id = ${servited.id}
  `;

  await sql`
    UPDATE subscriptions
    SET
      status = 'active',
      is_trial_active = false,
      first_payment_date = COALESCE(first_payment_date, now()),
      next_payment_date = NULL,
      updated_at = now()
    WHERE id = ${servited.subscription_id}
  `;

  const updatedRows = await sql`
    SELECT
      c.id,
      c.name,
      c.company_alias,
      c.demo_mode,
      c.scheduled_for_deletion,
      c.deletion_scheduled_at,
      c.deletion_will_occur_at,
      s.id AS subscription_id,
      s.status,
      s.is_trial_active,
      s.stripe_customer_id,
      s.stripe_subscription_id,
      s.first_payment_date,
      s.next_payment_date
    FROM companies c
    LEFT JOIN subscriptions s ON s.company_id = c.id
    WHERE c.id = ${servited.id}
    LIMIT 1
  `;

  console.log('✅ Estado actualizado de Servited:');
  console.log(JSON.stringify(updatedRows[0], null, 2));
}

setServitedDemoSubscription()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });