import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { oauthConfig } from "./config.js";

/**
 * Build WWW-Authenticate header value.
 */
function buildWwwAuthenticateHeader(error?: string, errorDescription?: string): string {
  const { mcpServerUrl } = oauthConfig;
  const resourceMetadataUrl = `${mcpServerUrl}/.well-known/oauth-protected-resource`;

  let value = `Bearer resource_metadata="${resourceMetadataUrl}"`;
  if (error) {
    value += `, error="${error}"`;
  }
  if (errorDescription) {
    value += `, error_description="${errorDescription}"`;
  }
  return value;
}

/**
 * Centralized auth error handler.
 * Handles various JWT/OAuth errors and returns appropriate responses.
 */
export const handleAuthError: ErrorRequestHandler = (
  err: Error & { code?: string; name?: string; status?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip if response already sent
  if (res.headersSent) {
    next(err);
    return;
  }

  // Token expiration
  if (err.code === "ERR_JWT_EXPIRED" || err.message?.includes("expired")) {
    res.set("WWW-Authenticate", buildWwwAuthenticateHeader("invalid_token", "Token expired"));
    res.status(401).json({
      error: "invalid_token",
      error_description: "The access token has expired",
    });
    return;
  }

  // Invalid token structure or signature
  if (
    err.name === "UnauthorizedError" ||
    err.code === "ERR_JWT_INVALID" ||
    err.code === "ERR_JWS_INVALID"
  ) {
    res.set("WWW-Authenticate", buildWwwAuthenticateHeader("invalid_token"));
    res.status(401).json({
      error: "invalid_token",
      error_description: "The access token is malformed or signature verification failed",
    });
    return;
  }

  // Missing authorization header
  if (err.code === "credentials_required") {
    res.set("WWW-Authenticate", buildWwwAuthenticateHeader());
    res.status(401).json({
      error: "invalid_request",
      error_description: "Authorization header is required",
    });
    return;
  }

  // Pass to general error handler
  next(err);
};

/**
 * General error handler for non-auth errors.
 */
export const handleGeneralError: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error("Unhandled error:", err);

  res.status(500).json({
    error: "server_error",
    error_description:
      oauthConfig.nodeEnv === "development" ? err.message : "An internal server error occurred",
  });
};

/**
 * Structured logging for auth events.
 */
export function logAuthEvent(
  event: string,
  req: Request & { auth?: Record<string, unknown> },
  details: Record<string, unknown> = {}
): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      tenantId: req.auth?.tid,
      userId: req.auth?.sub,
      clientId: req.auth?.azp,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      ...details,
    })
  );
}
