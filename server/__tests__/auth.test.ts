import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, validateOauthState, verifyPassword } from "../middleware/auth";

test("hashPassword + verifyPassword validate correct credentials", async () => {
  const password = "S3curePa$$w0rd";
  const hash = await hashPassword(password);

  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("verifyPassword returns false for malformed hash", async () => {
  assert.equal(await verifyPassword("password", "not-a-scrypt-hash"), false);
});

test("validateOauthState uses safe equality checks", () => {
  const req = { session: { githubOauthState: "state-123" } } as any;
  assert.equal(validateOauthState(req, "state-123"), true);
  assert.equal(validateOauthState(req, "state-124"), false);
  assert.equal(validateOauthState({ session: {} } as any, "state-123"), false);
});
