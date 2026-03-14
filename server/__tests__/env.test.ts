import test from "node:test";
import assert from "node:assert/strict";
import { validateEnv } from "../env";

test("validateEnv requires production secrets", () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://db",
      }),
    /SESSION_SECRET \(or AUTH_SECRET\) is required in production/
  );

  const parsed = validateEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://db",
    SESSION_SECRET: "secret",
    DATA_ENCRYPTION_KEY: "super-secret-key",
  });

  assert.equal(parsed.NODE_ENV, "production");
});

test("validateEnv accepts production env when required vars are present", () => {
  const parsed = validateEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://db",
    SESSION_SECRET: "secret",
    DATA_ENCRYPTION_KEY: "super-secret-key",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
  });

  assert.equal(parsed.NODE_ENV, "production");
  assert.equal(parsed.PORT, 5000);
});


test("validateEnv rejects default placeholder secrets in production", () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://db",
        SESSION_SECRET: "change-me",
        DATA_ENCRYPTION_KEY: "base64-or-hex-32-byte-key",
      }),
    /Refusing to start in production with default secrets/
  );
});
