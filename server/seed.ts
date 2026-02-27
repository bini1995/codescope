import { storage } from "./storage";
import { db } from "./db";
import { audits } from "@shared/schema";

export async function seedDatabase() {
  const existing = await db.select().from(audits).limit(1);
  if (existing.length > 0) return;

  const audit1 = await storage.createAudit({
    repoUrl: "https://github.com/acme-startup/saas-dashboard",
    repoName: "saas-dashboard",
    ownerName: "acme-startup",
    stack: "Next.js / TypeScript / Prisma",
    deploymentTarget: "Vercel",
    contactEmail: "cto@acmestartup.io",
    contactName: "Marcus Chen",
    status: "complete",
    biggestConcern: "We shipped fast and I'm worried about security holes and leaked API keys",
  });

  await storage.updateAudit(audit1.id, {
    securityScore: 3,
    stabilityScore: 5,
    maintainabilityScore: 4,
    scalabilityScore: 6,
    cicdScore: 2,
    executiveSummary: "This codebase has 4 critical security vulnerabilities that require immediate attention. Hardcoded API keys were found in 3 files, authentication middleware is missing on 7 admin endpoints, and the database connection string is exposed in the client bundle. The dependency tree contains 2 packages with known CVEs. Immediate remediation is strongly recommended before any further feature development.",
    remediationPlan: [
      { phase: "Stop the Bleeding", days: "Day 1-2", tasks: ["Rotate all exposed API keys and secrets", "Add .env to .gitignore and purge from git history", "Add authentication middleware to all admin routes"] },
      { phase: "Stabilize", days: "Day 3-7", tasks: ["Update vulnerable dependencies (lodash, axios)", "Add input validation on all API endpoints", "Implement proper CORS configuration", "Add rate limiting to authentication endpoints"] },
      { phase: "Harden", days: "Day 8-14", tasks: ["Set up GitHub Actions CI pipeline with security scanning", "Add Semgrep rules for custom patterns", "Implement proper error handling and logging", "Add database query parameterization"] },
    ],
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "security",
    severity: "critical",
    title: "Hardcoded Stripe Secret Key in Source Code",
    description: "The Stripe secret key (sk_live_*) is hardcoded directly in the payment processing module. This key has full access to your Stripe account including the ability to issue refunds, create charges, and access customer data.",
    filePath: "src/lib/payments.ts",
    lineStart: 12,
    lineEnd: 12,
    codeSnippet: 'const stripe = new Stripe("sk_live_51H7...redacted...xYz");',
    businessImpact: "An attacker with access to your source code or git history can steal this key and drain your Stripe account, issue unauthorized refunds, or access all customer payment data. This is a PCI compliance violation.",
    fixSteps: "1. Immediately rotate the Stripe key in your Stripe dashboard\n2. Move the key to an environment variable: process.env.STRIPE_SECRET_KEY\n3. Add .env to .gitignore\n4. Use git-filter-branch or BFG to purge the key from git history\n5. Enable Stripe's restricted API keys for production",
    effort: "S",
    status: "open",
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "security",
    severity: "critical",
    title: "Missing Authentication on Admin API Routes",
    description: "Seven admin endpoints under /api/admin/* have no authentication middleware. Any unauthenticated user can access these endpoints to modify user roles, delete accounts, and export user data.",
    filePath: "src/routes/admin.ts",
    lineStart: 15,
    lineEnd: 89,
    codeSnippet: 'router.post("/api/admin/users/delete", async (req, res) => {\n  // No auth check\n  await deleteUser(req.body.userId);\n});',
    businessImpact: "Complete unauthorized access to admin functionality. An attacker can delete all user accounts, escalate privileges, and exfiltrate the entire user database.",
    fixSteps: "1. Create an authentication middleware that validates JWT tokens\n2. Add a role-based access control check for 'admin' role\n3. Apply the middleware to all /api/admin/* routes\n4. Add request logging for all admin actions\n5. Implement IP allowlisting for admin endpoints",
    effort: "M",
    status: "open",
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "security",
    severity: "high",
    title: "SQL Injection via String Concatenation",
    description: "User input is being directly concatenated into SQL queries without parameterization in the search endpoint.",
    filePath: "src/db/queries.ts",
    lineStart: 45,
    lineEnd: 47,
    codeSnippet: 'const results = await db.query(`SELECT * FROM products WHERE name LIKE \'%${searchTerm}%\'`);',
    businessImpact: "An attacker can execute arbitrary SQL queries against your database, potentially extracting all user data, passwords, and payment information.",
    fixSteps: "1. Replace string concatenation with parameterized queries\n2. Use your ORM's built-in query builder (Prisma's findMany with where clause)\n3. Add input sanitization as a defense-in-depth measure\n4. Enable SQL query logging to detect exploitation attempts",
    effort: "S",
    status: "open",
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "stability",
    severity: "high",
    title: "Hallucinated NPM Package: react-server-components",
    description: "The package 'react-server-components' in package.json does not exist on npm. This was likely generated by an AI coding assistant and will cause build failures.",
    filePath: "package.json",
    lineStart: 24,
    lineEnd: 24,
    codeSnippet: '"react-server-components": "^2.1.0"',
    businessImpact: "npm install will fail in CI/CD environments or on new developer machines, blocking all deployments and onboarding.",
    fixSteps: "1. Remove 'react-server-components' from package.json\n2. Identify what functionality was intended and find the correct package\n3. Run npm ci to verify the lockfile is consistent\n4. Add a pre-commit hook that validates all packages exist",
    effort: "S",
    status: "open",
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "maintainability",
    severity: "medium",
    title: "Mega File: routes.ts Contains 2,847 Lines",
    description: "The main routes file contains all API logic in a single file with no separation of concerns. This makes it extremely difficult to review, test, or modify without introducing regressions.",
    filePath: "src/routes.ts",
    lineStart: 1,
    lineEnd: 2847,
    codeSnippet: null,
    businessImpact: "Development velocity will decrease significantly. Every change risks breaking unrelated functionality. Code reviews become impossible to do thoroughly.",
    fixSteps: "1. Split routes by domain (auth, users, products, payments, admin)\n2. Create a route registration pattern using Express.Router()\n3. Extract business logic into service modules\n4. Add unit tests for each service module\n5. Use barrel exports for clean imports",
    effort: "L",
    status: "open",
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "scalability",
    severity: "medium",
    title: "N+1 Query Pattern in User Dashboard",
    description: "The dashboard endpoint fetches all users, then makes individual database queries for each user's recent activity. With 1,000 users this generates 1,001 queries per page load.",
    filePath: "src/routes/dashboard.ts",
    lineStart: 34,
    lineEnd: 42,
    codeSnippet: 'const users = await getUsers();\nfor (const user of users) {\n  user.activity = await getRecentActivity(user.id);\n}',
    businessImpact: "Page load times will increase linearly with user count. At 10,000 users, the dashboard will timeout. Database connection pool will be exhausted under moderate traffic.",
    fixSteps: "1. Replace the loop with a single JOIN query or batch query\n2. Use Prisma's include/select for eager loading\n3. Add pagination to limit results per page\n4. Consider caching frequently accessed dashboard data with Redis",
    effort: "M",
    status: "open",
  });

  await storage.createFinding({
    auditId: audit1.id,
    category: "cicd",
    severity: "medium",
    title: "No CI/CD Pipeline Configured",
    description: "No GitHub Actions workflows, no pre-commit hooks, no automated testing, and no deployment automation. All deployments are manual via the Vercel dashboard.",
    filePath: null,
    lineStart: null,
    lineEnd: null,
    codeSnippet: null,
    businessImpact: "No automated quality gates means bugs and security vulnerabilities reach production unchecked. Manual deployments are error-prone and not auditable.",
    fixSteps: "1. Add a GitHub Actions workflow with lint, type-check, and test steps\n2. Add npm audit and Semgrep to the CI pipeline\n3. Enable branch protection rules requiring CI to pass\n4. Configure Vercel to deploy only from the main branch after CI passes\n5. Add a pre-commit hook with husky for fast local checks",
    effort: "M",
    status: "open",
  });

  const audit2 = await storage.createAudit({
    repoUrl: "https://github.com/healthtech-co/patient-portal",
    repoName: "patient-portal",
    ownerName: "healthtech-co",
    stack: "React / Express / MongoDB",
    deploymentTarget: "AWS EC2",
    contactEmail: "dev@healthtech.co",
    contactName: "Sarah Kim",
    status: "in_progress",
    biggestConcern: "We handle patient data and need to make sure we're HIPAA compliant",
  });

  await storage.updateAudit(audit2.id, {
    securityScore: 2,
    stabilityScore: 6,
    maintainabilityScore: 5,
    scalabilityScore: 4,
    cicdScore: 3,
  });

  await storage.createFinding({
    auditId: audit2.id,
    category: "security",
    severity: "critical",
    title: "Patient PII Stored in Plaintext",
    description: "Patient Social Security numbers, date of birth, and medical record numbers are stored as plaintext strings in MongoDB with no encryption at rest or field-level encryption.",
    filePath: "models/Patient.js",
    lineStart: 8,
    lineEnd: 15,
    codeSnippet: 'const PatientSchema = new Schema({\n  ssn: { type: String },\n  dob: { type: String },\n  medicalRecordNumber: { type: String },\n});',
    businessImpact: "This is a HIPAA violation. A database breach would expose all patient PII in plaintext. Fines can reach $1.5M per violation category per year, plus mandatory breach notifications to all affected patients.",
    fixSteps: "1. Enable MongoDB field-level encryption for all PII fields\n2. Implement application-level encryption using AES-256\n3. Store encryption keys in AWS KMS, not in the application\n4. Add audit logging for all PII access\n5. Conduct a HIPAA security risk assessment",
    effort: "L",
    status: "open",
  });

  await storage.createAudit({
    repoUrl: "https://github.com/indie-dev/task-tracker",
    repoName: "task-tracker",
    ownerName: "indie-dev",
    stack: "Vue.js / Firebase",
    deploymentTarget: "Firebase Hosting",
    contactEmail: "alex@indiehacker.dev",
    contactName: "Alex Rivera",
    status: "pending",
    biggestConcern: "Built the whole thing with Claude and Cursor in a weekend, no idea what's wrong",
  });

  const audit4 = await storage.createAudit({
    repoUrl: "https://github.com/ecom-labs/shopfront",
    repoName: "shopfront",
    ownerName: "ecom-labs",
    stack: "Remix / Supabase / Tailwind",
    deploymentTarget: "Fly.io",
    contactEmail: "founder@ecomlabs.com",
    contactName: "Jordan Ellis",
    status: "complete",
    biggestConcern: "Cart and checkout flow feels buggy, worried about losing sales",
  });

  await storage.updateAudit(audit4.id, {
    securityScore: 7,
    stabilityScore: 4,
    maintainabilityScore: 7,
    scalabilityScore: 5,
    cicdScore: 6,
    executiveSummary: "Overall security posture is reasonable with Supabase handling auth. The primary concerns are in stability — the checkout flow has race conditions that can lead to duplicate charges, and the cart state management has edge cases that cause data loss. Dependencies are well-maintained with no hallucinated packages. A focused 7-day sprint on the checkout flow and adding proper error boundaries would significantly improve reliability.",
    remediationPlan: [
      { phase: "Stop the Bleeding", days: "Day 1-2", tasks: ["Add mutex/locking to checkout submission", "Fix cart state race condition on concurrent updates", "Add idempotency keys to Stripe integration"] },
      { phase: "Stabilize", days: "Day 3-7", tasks: ["Implement proper error boundaries in React", "Add retry logic with exponential backoff", "Set up Sentry for production error monitoring"] },
      { phase: "Harden", days: "Day 8-14", tasks: ["Add end-to-end tests for checkout flow", "Implement proper inventory locking", "Add webhook signature verification"] },
    ],
  });

  await storage.createFinding({
    auditId: audit4.id,
    category: "stability",
    severity: "critical",
    title: "Race Condition in Checkout Causes Duplicate Charges",
    description: "The checkout handler doesn't prevent duplicate submissions. Double-clicking the 'Pay' button or network retries can create multiple Stripe charges for the same order.",
    filePath: "app/routes/checkout.tsx",
    lineStart: 78,
    lineEnd: 95,
    codeSnippet: 'export async function action({ request }: ActionArgs) {\n  const formData = await request.formData();\n  // No idempotency key, no dedup check\n  const charge = await stripe.charges.create({\n    amount: cart.total,\n    currency: "usd",\n  });\n}',
    businessImpact: "Customers are being charged multiple times for a single purchase. This leads to chargebacks, customer complaints, and potential loss of Stripe account. Each duplicate charge costs you the chargeback fee plus reputational damage.",
    fixSteps: "1. Add a client-side debounce and disable the button after first click\n2. Generate an idempotency key per checkout session\n3. Pass the idempotency key to stripe.charges.create()\n4. Add a server-side check for existing charges with the same order ID\n5. Return the existing charge if a duplicate is detected",
    effort: "S",
    status: "open",
  });

  console.log("Database seeded with sample audit data");
}
