import { Request, Response, NextFunction, RequestHandler } from "express";
import { oauthConfig } from "./config.js";

/**
 * Security headers middleware.
 * Adds standard security headers to all responses.
 */
export const securityHeaders: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Prevent clickjacking
  res.set("X-Frame-Options", "DENY");
  res.set("Content-Security-Policy", "frame-ancestors 'none'");

  // Prevent MIME type sniffing
  res.set("X-Content-Type-Options", "nosniff");

  // HSTS - enforce HTTPS (only in production)
  if (oauthConfig.nodeEnv === "production") {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Prevent caching of authenticated responses
  if (req.headers.authorization) {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
  }

  next();
};
