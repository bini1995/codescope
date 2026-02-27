import { getUncachableStripeClient } from "./stripeClient";

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    const existing = await stripe.products.search({
      query: "name:'CodeAudit Report Unlock'",
    });

    if (existing.data.length > 0) {
      console.log("Stripe product already exists:", existing.data[0].id);
      return;
    }

    const product = await stripe.products.create({
      name: "CodeAudit Report Unlock",
      description:
        "Unlock full remediation details for your code audit: fix steps for every finding, code evidence, and a 14-day remediation roadmap.",
      metadata: {
        type: "audit_unlock",
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 4900,
      currency: "usd",
    });

    console.log(`Stripe product created: ${product.id}, price: ${price.id} ($49.00)`);
  } catch (error: any) {
    console.error("Failed to seed Stripe products:", error.message);
  }
}
