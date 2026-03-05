import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const ENVELOPE_VERSION = "v1" as const;

type EncryptedJsonEnvelope = {
  __enc: typeof ENVELOPE_VERSION;
  iv: string;
  tag: string;
  data: string;
};

function getEncryptionKey(): Buffer | null {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) return null;

  const keyBuffer = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (keyBuffer.length === 32) return keyBuffer;
  return createHash("sha256").update(raw).digest();
}

const key = getEncryptionKey();

function encryptText(plainText: string): string {
  if (!key) return plainText;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${ENVELOPE_VERSION}:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptText(value: string): string {
  if (!key) return value;
  if (!value.startsWith(`enc:${ENVELOPE_VERSION}:`)) return value;

  const parts = value.split(":");
  if (parts.length !== 5) return value;

  const [, , ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function encryptSensitiveText(value: string | null | undefined): string | null | undefined {
  if (typeof value !== "string") return value;
  return encryptText(value);
}

export function decryptSensitiveText(value: string | null | undefined): string | null | undefined {
  if (typeof value !== "string") return value;
  try {
    return decryptText(value);
  } catch {
    return value;
  }
}

export function encryptSensitiveJson(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (!key) return value;

  const payload = encryptText(JSON.stringify(value));
  const [, version, iv, tag, data] = payload.split(":").slice(1);
  return { __enc: version as typeof ENVELOPE_VERSION, iv, tag, data } satisfies EncryptedJsonEnvelope;
}

export function decryptSensitiveJson<T>(value: unknown): T | null {
  if (value === undefined || value === null) return value as T | null;
  if (!key) return value as T;

  const v = value as Partial<EncryptedJsonEnvelope>;
  if (v.__enc !== ENVELOPE_VERSION || !v.iv || !v.tag || !v.data) {
    return value as T;
  }

  try {
    const decrypted = decryptText(`enc:${v.__enc}:${v.iv}:${v.tag}:${v.data}`);
    return JSON.parse(decrypted) as T;
  } catch {
    return value as T;
  }
}
