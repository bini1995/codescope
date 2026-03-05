import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { passportMiddleware, sessionMiddleware } from "./middleware/auth";

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === "production";
const trustProxy = process.env.TRUST_PROXY;
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required for Stripe integration");
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
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

initStripe().catch((error) => {
  console.error("Unhandled Stripe initialization error:", error);
});

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
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
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));
app.use(sessionMiddleware);
app.use(...passportMiddleware);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
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

const replitDomains = (process.env.REPLIT_DOMAINS || "")
  .split(",")
  .map((domain) => domain.trim())
  .filter(Boolean)
  .map((domain) => `https://${domain}`);

const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
  ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN.trim()}`]
  : [];

const allowedOrigins = [
  ...(process.env.FRONTEND_URL || "").split(","),
  ...(process.env.CORS_ALLOWED_ORIGINS || "").split(","),
  ...replitDomains,
  ...railwayDomain,
  ...devOrigins,
]
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginSet = new Set(allowedOrigins);

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

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "120", 10);
const ipRequestCounts = new Map<string, { count: number; expiresAt: number }>();

app.use("/api", (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = ipRequestCounts.get(key);

  if (!current || current.expiresAt <= now) {
    ipRequestCounts.set(key, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.expiresAt - now) / 1000));
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
      if (capturedJsonResponse && !isAuthPath) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
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
