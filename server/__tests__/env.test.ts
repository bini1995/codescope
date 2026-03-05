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
  });

  assert.equal(parsed.NODE_ENV, "production");
});

test("validateEnv accepts production env when required vars are present", () => {
  const parsed = validateEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://db",
    SESSION_SECRET: "secret",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
  });

  assert.equal(parsed.NODE_ENV, "production");
  assert.equal(parsed.PORT, 5000);
});
