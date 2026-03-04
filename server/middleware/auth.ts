import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual, randomBytes, scryptSync, createHmac } from "crypto";

const TOKEN_COOKIE = "codescope_auth";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
const SECRET = process.env.AUTH_SECRET || "dev-auth-secret-change-me";

function getCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "none";
  maxAge: number;
  path: "/";
} {
  const crossSite = Boolean(process.env.FRONTEND_URL);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || crossSite,
    sameSite: crossSite ? "none" : "lax",
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  };
}

type AuthPayload = {
  sub: string;
  email: string;
  exp: number;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signToken(payload: AuthPayload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${sig}`;
}

function verifyToken(token: string): AuthPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expectedSig = b64url(createHmac("sha256", SECRET).update(body).digest());
  const sameLength = sig.length === expectedSig.length;
  if (!sameLength) return null;
  const validSig = timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  if (!validSig) return null;

  try {
    const normalizedBody = body.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(Buffer.from(normalizedBody, "base64").toString("utf8")) as AuthPayload;
    if (!parsed.sub || !parsed.email || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  if (derived.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(derived), Buffer.from(storedHash));
}

export function createAuthSession(res: Response, user: { id: string; email: string }) {
  const token = signToken({
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });

  res.cookie(TOKEN_COOKIE, token, getCookieOptions());
}

export function clearAuthSession(res: Response) {
  const { maxAge: _maxAge, ...cookieOptions } = getCookieOptions();
  res.clearCookie(TOKEN_COOKIE, cookieOptions);
}

function getCookieValue(req: Request, key: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(";").map((part) => part.trim());
  for (const pair of pairs) {
    const [k, ...rest] = pair.split("=");
    if (k === key) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getCookieValue(req, TOKEN_COOKIE);
  if (!token) return next();
  const payload = verifyToken(token);
  if (payload) {
    req.auth = payload;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getCookieValue(req, TOKEN_COOKIE);
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }

  req.auth = payload;
  next();
}
