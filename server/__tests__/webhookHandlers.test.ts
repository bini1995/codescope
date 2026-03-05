import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { processStripeWebhookTransition } from "../webhookHandlers";

function checkoutEvent(overrides?: Partial<Stripe.Checkout.Session>): Stripe.Event {
  return {
    id: "evt_123",
    object: "event",
    api_version: "2025-08-27.basil",
    created: 0,
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        metadata: { auditId: "audit_123" },
        payment_status: "paid",
        ...overrides,
      } as Stripe.Checkout.Session,
    },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  } as Stripe.Event;
}

test("records non-checkout events as processed", async () => {
  const calls: any[] = [];
  const result = await processStripeWebhookTransition(
    { id: "evt_other", type: "invoice.created" } as Stripe.Event,
    {
      recordStripeWebhookEvent: async (payload) => {
        calls.push(payload);
        return true;
      },
      processPaidCheckoutWebhookEvent: async () => true,
    } as any
  );

  assert.equal(result, false);
  assert.equal(calls[0].status, "processed");
});

test("marks invalid checkout sessions as ignored", async () => {
  const calls: any[] = [];
  const result = await processStripeWebhookTransition(
    checkoutEvent({ payment_status: "unpaid", metadata: {} }),
    {
      recordStripeWebhookEvent: async (payload) => {
        calls.push(payload);
        return true;
      },
      processPaidCheckoutWebhookEvent: async () => true,
    } as any
  );

  assert.equal(result, false);
  assert.equal(calls[0].status, "ignored");
});

test("processes paid checkout sessions with audit metadata", async () => {
  const calls: any[] = [];
  const result = await processStripeWebhookTransition(checkoutEvent(), {
    recordStripeWebhookEvent: async () => true,
    processPaidCheckoutWebhookEvent: async (payload) => {
      calls.push(payload);
      return true;
    },
  } as any);

  assert.equal(result, true);
  assert.equal(calls[0].auditId, "audit_123");
  assert.equal(calls[0].stripeSessionId, "cs_test_123");
});
