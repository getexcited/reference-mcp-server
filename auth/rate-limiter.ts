import rateLimit from "express-rate-limit";
import { AuthenticatedRequest } from "./jwt-middleware.js";

/**
 * Rate limit for metadata endpoints (permissive).
 * These endpoints are public and may be accessed frequently during discovery.
 */
export const metadataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: { error: "too_many_requests", error_description: "Rate limit exceeded" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit for protected MCP endpoints (stricter).
 * Uses per-user limiting if authenticated, otherwise falls back to IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.auth?.sub || req.ip || "unknown";
  },
  message: { error: "too_many_requests", error_description: "Rate limit exceeded" },
  standardHeaders: true,
  legacyHeaders: false,
});
