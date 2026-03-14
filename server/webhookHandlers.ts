import Stripe from "stripe";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";
import { enqueueScan } from "./scanQueue";

type WebhookEventStorage = Pick<typeof storage, "recordStripeWebhookEvent" | "processPaidCheckoutWebhookEvent">;

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

    const transition = await processStripeWebhookTransition(event, storage);

    if (transition.processed && transition.auditId) {
      const queueResult = enqueueScan(transition.auditId);
      console.log(`Checkout webhook ${event.id} unlocked audit ${transition.auditId} payment and queued scan (queued=${queueResult.queued}, position=${queueResult.position})`);
    }
  }
}

export async function processStripeWebhookTransition(
  event: Stripe.Event,
  webhookStorage: WebhookEventStorage
): Promise<{ processed: boolean; auditId?: string }> {
  if (event.type !== "checkout.session.completed") {
    await webhookStorage.recordStripeWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      status: "processed",
    });
    return { processed: false };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const auditId = session.metadata?.auditId;

  if (!auditId || session.payment_status !== "paid" || !session.id) {
    await webhookStorage.recordStripeWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      auditId,
      stripeSessionId: session.id,
      status: "ignored",
    });
    return { processed: false };
  }

  const processed = await webhookStorage.processPaidCheckoutWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    auditId,
    stripeSessionId: session.id,
  });

  return processed ? { processed: true, auditId } : { processed: false, auditId };
}
