import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const stripe = await getUncachableStripeClient();
      const event = JSON.parse(payload.toString());

      if (event.type === 'checkout.session.completed') {
        const session = event.data?.object;
        if (session?.payment_status === 'paid' && session?.metadata?.auditId) {
          const auditId = session.metadata.auditId;
          await storage.updateAudit(auditId, {
            paidAt: new Date(),
            stripeSessionId: session.id,
          });
          console.log(`Audit ${auditId} unlocked via webhook payment`);
        }
      }
    } catch (err: any) {
      console.error('Error processing payment webhook:', err.message);
    }
  }
}
