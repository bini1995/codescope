import type { Request, Response, NextFunction } from "express";

type Entry = { count: number; resetAt: number };

export function createRateLimit(options: {
  windowMs: number;
  max: number;
  message: string;
}) {
  const hits = new Map<string, Entry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfter.toString());
      return res.status(429).json({ message: options.message });
    }

    return next();
  };
}
