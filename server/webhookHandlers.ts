import Stripe from "stripe";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for strict webhook signature verification");
  }

  return secret;
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, getWebhookSecret());

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    if (event.type !== "checkout.session.completed") {
      await storage.recordStripeWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        status: "processed",
      });
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const auditId = session.metadata?.auditId;

    if (!auditId || session.payment_status !== "paid" || !session.id) {
      await storage.recordStripeWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        auditId,
        stripeSessionId: session.id,
        status: "ignored",
      });
      return;
    }

    const processed = await storage.processPaidCheckoutWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      auditId,
      stripeSessionId: session.id,
    });

    if (processed) {
      console.log(`Audit ${auditId} unlocked via webhook payment`);
    }
  }
}
