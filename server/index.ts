import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { passportMiddleware, sessionMiddleware } from "./middleware/auth";
import { validateEnv } from "./env";

const env = validateEnv();
const isProduction = env.NODE_ENV === "production";
const hasReplitConnectorAuth = Boolean(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);

function assertNoDefaultProductionSecrets() {
  if (!isProduction) return;

  const insecureDefaults = new Set([
    "change-me",
    "dev-session-secret-change-me",
    "base64-or-hex-32-byte-key",
  ]);

  const configuredSecrets = [
    env.SESSION_SECRET,
    env.AUTH_SECRET,
    env.STRIPE_WEBHOOK_SECRET,
    process.env.DATA_ENCRYPTION_KEY,
  ].filter((value): value is string => Boolean(value));

  const hasDefaultSecret = configuredSecrets
    .map((value) => value.trim().toLowerCase())
    .some((value) => insecureDefaults.has(value));

  if (hasDefaultSecret) {
    throw new Error(
      "Refusing to boot in production: replace default secrets (SESSION_SECRET/AUTH_SECRET, DATA_ENCRYPTION_KEY, STRIPE_WEBHOOK_SECRET) with real values."
    );
  }
}

assertNoDefaultProductionSecrets();

const app = express();
const httpServer = createServer(app);

const trustProxy = env.TRUST_PROXY;
app.set(
  "trust proxy",
  typeof trustProxy === "string"
    ? trustProxy === "true" || trustProxy === "1"
      ? 1
      : trustProxy
    : isProduction
);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = env.DATABASE_URL;

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${env.REPLIT_DOMAINS?.split(",")[0]}`;
    const result = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    console.log("Webhook configured:", result?.webhook?.url || "ready");

    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: any) => console.error("Error syncing Stripe data:", err));
  } catch (error) {
    console.error("Failed to initialize Stripe:", error);
  }
}

if (!env.SKIP_STRIPE_INIT && hasReplitConnectorAuth) {
  initStripe().catch((error) => {
    console.error("Unhandled Stripe initialization error:", error);
  });
} else if (!env.SKIP_STRIPE_INIT && !hasReplitConnectorAuth) {
  console.warn(
    "Skipping Stripe sync initialization outside Replit connector runtime. Set SKIP_STRIPE_INIT=true to silence this warning."
  );
}

if (isProduction && !env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    "STRIPE_WEBHOOK_SECRET is not set; Stripe webhook signature verification is disabled until this is configured."
  );
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: "Stripe webhook is not configured" });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error("Webhook: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: "50kb" }));
app.use(sessionMiddleware);
app.use(...passportMiddleware);

const cspPolicy = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", cspPolicy);
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  next();
});

const devOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const replitDomains = (env.REPLIT_DOMAINS || "")
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean)
  .map((domain) => `https://${domain}`);

const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN
  ? [`https://${env.RAILWAY_PUBLIC_DOMAIN.trim()}`]
  : [];

const allowedOrigins = [
  ...(env.FRONTEND_URL || "").split(","),
  ...(env.CORS_ALLOWED_ORIGINS || "").split(","),
  ...replitDomains,
  ...railwayDomain,
  ...devOrigins,
]
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginSet = new Set(allowedOrigins);

if (isProduction && allowedOriginSet.size === 0) {
  throw new Error("CORS allowlist is empty in production. Set FRONTEND_URL or CORS_ALLOWED_ORIGINS.");
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOriginSet.has(origin)) {
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  } else if (origin) {
    return res.status(403).json({ message: "Origin not allowed" });
  }

  if (req.method === "OPTIONS") {
    return res.status(204).send();
  }

  next();
});

const RATE_LIMIT_WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;
const RATE_LIMIT_MAX_REQUESTS = env.RATE_LIMIT_MAX_REQUESTS;
const AUTH_RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_MAX_TRACKED_IPS = 10_000;
const ipRequestCounts = new Map<string, { count: number; expiresAt: number }>();

function getRateLimitEntry(ip: string, maxRequests: number, now: number) {
  const current = ipRequestCounts.get(ip);

  if (!current || current.expiresAt <= now) {
    if (ipRequestCounts.size >= RATE_LIMIT_MAX_TRACKED_IPS) {
      for (const [key, value] of ipRequestCounts) {
        if (value.expiresAt <= now) {
          ipRequestCounts.delete(key);
        }
      }
    }

    const fresh = { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS };
    ipRequestCounts.set(ip, fresh);
    return { entry: fresh, limited: false, remaining: Math.max(0, maxRequests - 1) };
  }

  current.count += 1;
  return {
    entry: current,
    limited: current.count > maxRequests,
    remaining: Math.max(0, maxRequests - current.count),
  };
}

app.use("/api", (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const authSensitivePath = req.path.startsWith("/auth/login") || req.path.startsWith("/auth/register");
  const limit = authSensitivePath ? AUTH_RATE_LIMIT_MAX_REQUESTS : RATE_LIMIT_MAX_REQUESTS;
  const result = getRateLimitEntry(key, limit, now);

  res.setHeader("X-RateLimit-Limit", limit.toString());
  res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
  if (result.limited) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.entry.expiresAt - now) / 1000));
    res.setHeader("Retry-After", retryAfterSeconds.toString());
    return res.status(429).json({ message: "Too many requests, please try again later." });
  }

  return next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const isAuthPath = path.startsWith("/api/auth");
      const shouldLogBody = !isAuthPath && !path.includes("checkout") && !path.includes("verify-payment");
      if (capturedJsonResponse && shouldLogBody) {
        const serialized = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${serialized.length > 500 ? `${serialized.slice(0, 500)}...(truncated)` : serialized}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { seedDatabase } = await import("./seed");
  await seedDatabase();
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (req.path.startsWith("/api/auth")) {
      console.error("Authentication error");
    } else {
      console.error("Internal Server Error:", err);
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = env.PORT;
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
