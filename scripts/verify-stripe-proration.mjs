import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function verifyStripeProration() {
  try {
    console.log('🔐 VERIFICACIÓN DE STRIPE - HISTORIAL DE PRORRATEO\n');
    console.log('═'.repeat(80));

    const subscriptionId = 'sub_1Szv7fAV82eLGUEZXQEcSteA';

    console.log(`\n📋 Obteniendo detalles de suscripción: ${subscriptionId}\n`);

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    console.log(`\n1️⃣  INFORMACIÓN GENERAL DE LA SUSCRIPCIÓN:`);
    console.log('─'.repeat(80));
    console.log(`
Status:                 ${subscription.status}
Created:                ${new Date(subscription.created * 1000).toLocaleString('es-ES')}
Current Period Start:   ${new Date(subscription.current_period_start * 1000).toLocaleString('es-ES')}
Current Period End:     ${new Date(subscription.current_period_end * 1000).toLocaleString('es-ES')}
Billing Cycle Days:     ${Math.ceil((subscription.current_period_end - subscription.current_period_start) / 86400)} days
    `);

    console.log(`\n2️⃣  ITEMS ACTUALES EN LA SUSCRIPCIÓN:`);
    console.log('─'.repeat(80));

    for (const item of subscription.items.data) {
      const product = await stripe.products.retrieve(item.price.product);
      console.log(`
Item ID:      ${item.id}
Product:      ${product.name}
Price:        €${(item.price.unit_amount / 100).toFixed(2)}/mes
Quantity:     ${item.quantity} seats
Billing:      ${item.price.recurring?.interval === 'month' ? 'Monthly' : 'Other'}
      `);
    }

    console.log(`\n3️⃣  BÚSQUEDA DE FACTURAS (ÚLTIMAS 12 MESES):`);
    console.log('─'.repeat(80));

    // Get invoices for this subscription
    const invoices = await stripe.invoices.list({
      subscription: subscriptionId,
      limit: 12,
    });

    if (invoices.data.length === 0) {
      console.log('No invoices found');
    } else {
      for (const invoice of invoices.data) {
        console.log(`
Invoice #:    ${invoice.number}
Amount Due:   €${(invoice.amount_due / 100).toFixed(2)}
Status:       ${invoice.status}
Date:         ${new Date(invoice.created * 1000).toLocaleString('es-ES')}
Period Start: ${new Date(invoice.period_start * 1000).toLocaleString('es-ES')}
Period End:   ${new Date(invoice.period_end * 1000).toLocaleString('es-ES')}
        `);

        // Get line items for this invoice
        console.log('  LINE ITEMS:');
        const lineItems = await stripe.invoices.listLineItems(invoice.id);
        
        for (const lineItem of lineItems.data) {
          const type = lineItem.type === 'invoiceitem' ? 'Custom' : 'Subscription';
          const qty = lineItem.quantity || 'N/A';
          const amount = (lineItem.amount / 100).toFixed(2);
          const description = lineItem.description || lineItem.plan?.nickname || 'Unknown';
          
          console.log(`    • ${description}`);
          console.log(`      Type: ${type}, Qty: ${qty}, Amount: €${amount}`);
          
          if (lineItem.proration || lineItem.proration_details) {
            console.log(`      ⚠️  PRORRATION DETECTED:`);
            if (lineItem.proration_details) {
              console.log(`          Credited Items: ${lineItem.proration_details.credited_items?.length || 0}`);
            }
          }
        }
      }
    }

    console.log(`\n4️⃣  HISTORIAL DE CAMBIOS (SUBSCRIPTION EVENTS):`);
    console.log('─'.repeat(80));

    // Get events for this subscription
    const events = await stripe.events.list({
      type: ['customer.subscription.updated'],
      limit: 20,
    });

    const subEvents = events.data.filter((event) => 
      event.data?.object?.id === subscriptionId
    );

    if (subEvents.length === 0) {
      console.log('No subscription update events found');
    } else {
      for (const event of subEvents.slice(0, 5)) {
        const eventData = event.data.object;
        console.log(`
Event Date:  ${new Date(event.created * 1000).toLocaleString('es-ES')}
Timestamp:   ${event.created}
Status:      ${eventData.status}
Items Count: ${eventData.items?.data?.length || 'N/A'}
        `);
        
        // Show any items that were added or updated
        if (eventData.items?.data) {
          for (const item of eventData.items.data) {
            if (item.price?.product) {
              const product = await stripe.products.retrieve(item.price.product);
              console.log(`  - ${product.name}: qty=${item.quantity}`);
            }
          }
        }
      }
    }

    console.log(`\n═`.repeat(80));
    console.log(`\n✅ VERIFICACIÓN DE STRIPE COMPLETADA\n`);

  } catch (error) {
    console.error('❌ Error verifying Stripe:', error?.message);
  }

  process.exit(0);
}

verifyStripeProration();
