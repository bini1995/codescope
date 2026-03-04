import { getUncachableStripeClient } from "./stripeClient";

export async function seedStripeProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    const productsToEnsure = [
      {
        name: "CodeAudit Instant Automated Scan",
        description: "Self-serve automated security and reliability scan for quick signal.",
        type: "instant_scan",
        amount: 9900,
      },
      {
        name: "CodeAudit Expert Code Audit",
        description: "Expert-led deep audit with prioritized findings and remediation roadmap.",
        type: "expert_audit",
        amount: 150000,
      },
    ];

    for (const productConfig of productsToEnsure) {
      const existing = await stripe.products.search({
        query: `active:'true' AND metadata['type']:'${productConfig.type}'`,
      });

      if (existing.data.length > 0) {
        console.log(`Stripe product already exists for ${productConfig.type}:`, existing.data[0].id);
        continue;
      }

      const product = await stripe.products.create({
        name: productConfig.name,
        description: productConfig.description,
        metadata: { type: productConfig.type },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: productConfig.amount,
        currency: "usd",
      });

      console.log(`Stripe product created: ${product.id}, price: ${price.id}`);
    }
  } catch (error: any) {
    console.error("Failed to seed Stripe products:", error.message);
  }
}
