import type { NextFunction, Request, Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { pool } from "../db";
import { storage } from "../storage";

const SESSION_IDLE_TIMEOUT_MS = parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || "900000", 10);
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.AUTH_SECRET || "dev-session-secret-change-me";
const isProduction = process.env.NODE_ENV === "production";

const PgSessionStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSessionStore({
    pool,
    createTableIfMissing: true,
    tableName: "user_sessions",
  }),
  name: "codescope_sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_IDLE_TIMEOUT_MS,
    path: "/",
  },
});

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      session: true,
    },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          return done(null, false, { message: "Invalid credentials" });
        }

        return done(null, { id: user.id, email: user.email });
      } catch (_err) {
        return done(null, false, { message: "Authentication failed" });
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUserById(id);
    if (!user) {
      return done(null, false);
    }

    return done(null, { id: user.id, email: user.email });
  } catch {
    return done(null, false);
  }
});

export const passportMiddleware = [passport.initialize(), passport.session()];

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedHash] = passwordHash.split("$");
  if (!algorithm || !salt || !storedHash || algorithm !== "scrypt") {
    return false;
  }

  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  if (derived.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(derived), Buffer.from(storedHash));
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function loginWithPassport(req: Request, user: { id: string; email: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    req.login(user, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function createAuthSession(req: Request, user: { id: string; email: string }) {
  await regenerateSession(req);
  await loginWithPassport(req, user);
}

export async function clearAuthSession(req: Request, res: Response) {
  await new Promise<void>((resolve) => {
    req.logout(() => resolve());
  });

  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });

  res.clearCookie("codescope_sid", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

export function validateOauthState(req: Request, incomingState: string) {
  const sessionState = req.session.githubOauthState;
  if (!sessionState || !incomingState) return false;
  return safeEqual(sessionState, incomingState);
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as { id: string; email: string };
    req.auth = { sub: user.id, email: user.email };
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = req.user as { id: string; email: string };
  req.auth = { sub: user.id, email: user.email };
  next();
}

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
    }

    interface Request {
      auth?: {
        sub: string;
        email: string;
      };
    }
  }
}

declare module "express-session" {
  interface SessionData {
    githubOauthState?: string;
  }
}
