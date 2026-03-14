import { z } from "zod";

const boolLike = z
  .string()
  .optional()
  .transform((value) => value === "true" || value === "1");

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  DATA_ENCRYPTION_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  FRONTEND_URL: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),
  REPLIT_DOMAINS: z.string().optional(),
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  SKIP_STRIPE_INIT: boolLike,
});

export type AppEnv = z.infer<typeof baseEnvSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = baseEnvSchema.parse(rawEnv);

  if (parsed.NODE_ENV === "production") {
    if (!parsed.SESSION_SECRET && !parsed.AUTH_SECRET) {
      throw new Error("SESSION_SECRET (or AUTH_SECRET) is required in production");
    }

    if (!parsed.DATA_ENCRYPTION_KEY) {
      throw new Error("DATA_ENCRYPTION_KEY is required in production");
    }

    const defaultSecrets = [
      parsed.SESSION_SECRET,
      parsed.AUTH_SECRET,
      parsed.DATA_ENCRYPTION_KEY,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toLowerCase());

    const insecureDefaults = new Set([
      "change-me",
      "dev-session-secret-change-me",
      "base64-or-hex-32-byte-key",
    ]);

    if (defaultSecrets.some((value) => insecureDefaults.has(value))) {
      throw new Error(
        "Refusing to start in production with default secrets. Set SESSION_SECRET/AUTH_SECRET and DATA_ENCRYPTION_KEY to real values."
      );
    }
  }

  return parsed;
}
