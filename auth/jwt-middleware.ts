import { expressjwt, GetVerificationKey } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { oauthConfig } from "./config.js";

/**
 * Extended Request type with auth context from JWT validation.
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    // Standard JWT claims
    sub: string; // Subject (user ID)
    iss: string; // Issuer
    aud: string | string[]; // Audience
    exp: number; // Expiration time
    iat: number; // Issued at
    nbf?: number; // Not before

    // Entra ID specific claims
    tid: string; // Tenant ID
    oid?: string; // Object ID (user's Entra ID object)
    azp?: string; // Authorized party (client ID)
    name?: string; // User's display name
    preferred_username?: string; // User's email/UPN
    scp?: string; // Delegated scopes (space-separated)
    roles?: string[]; // Application roles

    // Allow additional claims
    [key: string]: unknown;
  };
}

/**
 * Build the JWKS URI for token validation.
 */
function getJwksUri(): string {
  const { entraTenantId, allowAnyTenant } = oauthConfig;
  const tenantPath = allowAnyTenant ? "common" : entraTenantId;
  return `https://login.microsoftonline.com/${tenantPath}/discovery/v2.0/keys`;
}

/**
 * Create the base JWT validation middleware.
 * This validates the token signature, expiration, and audience.
 */
function createJwtCheck(): RequestHandler {
  const { entraClientId, entraTenantId, allowAnyTenant } = oauthConfig;

  return expressjwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      jwksUri: getJwksUri(),
    }) as GetVerificationKey,

    // Audience MUST match your Application ID URI exactly
    audience: `api://${entraClientId}`,

    // For multi-tenant: validate issuer manually after decoding
    // For single-tenant: can specify issuer here
    issuer: allowAnyTenant
      ? undefined
      : `https://login.microsoftonline.com/${entraTenantId}/v2.0`,

    // Only accept RS256 - explicitly reject 'none' and other algorithms
    algorithms: ["RS256"],
  });
}

/**
 * Validate that the token's tenant is authorized for multi-tenant deployments.
 */
export const validateTenant: RequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth) {
    next();
    return;
  }

  const { tid, iss } = req.auth;
  const { allowAnyTenant, authorizedTenants } = oauthConfig;

  // Validate issuer format matches the token's tenant
  const expectedIssuer = `https://login.microsoftonline.com/${tid}/v2.0`;
  if (iss !== expectedIssuer) {
    console.warn(`Issuer mismatch: expected ${expectedIssuer}, got ${iss}`);
    res.status(401).json({
      error: "invalid_token",
      error_description: "Token issuer validation failed",
    });
    return;
  }

  // Validate tenant is authorized (skip if allowing any tenant for dev)
  if (!allowAnyTenant && !authorizedTenants.includes(tid)) {
    console.warn(`Unauthorized tenant attempted access: ${tid}`);
    res.status(403).json({
      error: "access_denied",
      error_description: "Tenant is not authorized to access this resource",
    });
    return;
  }

  next();
};

/**
 * Build WWW-Authenticate header value per RFC 9728.
 */
function buildWwwAuthenticateHeader(
  error?: string,
  errorDescription?: string
): string {
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
 * Combined bearer auth middleware that:
 * 1. Validates JWT token
 * 2. Validates tenant for multi-tenant deployments
 * 3. Adds proper WWW-Authenticate headers on failure
 */
export function createBearerAuthMiddleware(): RequestHandler {
  const jwtCheck = createJwtCheck();

  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    jwtCheck(req, res, (err: unknown) => {
      if (err) {
        const error = err as Error & {
          code?: string;
          name?: string;
          status?: number;
        };

        // Handle missing authorization header
        if (
          error.code === "credentials_required" ||
          !req.headers.authorization
        ) {
          res.set("WWW-Authenticate", buildWwwAuthenticateHeader());
          res.status(401).json({
            error: "invalid_request",
            error_description: "Authorization header is required",
          });
          return;
        }

        // Handle expired tokens
        if (
          error.code === "ERR_JWT_EXPIRED" ||
          error.message?.includes("expired")
        ) {
          res.set(
            "WWW-Authenticate",
            buildWwwAuthenticateHeader("invalid_token", "Token expired")
          );
          res.status(401).json({
            error: "invalid_token",
            error_description: "The access token has expired",
          });
          return;
        }

        // Handle invalid token structure or signature
        if (
          error.name === "UnauthorizedError" ||
          error.code === "ERR_JWT_INVALID" ||
          error.code === "ERR_JWS_INVALID"
        ) {
          res.set(
            "WWW-Authenticate",
            buildWwwAuthenticateHeader("invalid_token")
          );
          res.status(401).json({
            error: "invalid_token",
            error_description:
              "The access token is malformed or signature verification failed",
          });
          return;
        }

        // Log unexpected errors for debugging
        console.error("Unhandled auth error:", {
          name: error.name,
          code: error.code,
          message: error.message,
          stack:
            oauthConfig.nodeEnv === "development" ? error.stack : undefined,
        });

        res.set(
          "WWW-Authenticate",
          buildWwwAuthenticateHeader("invalid_token")
        );
        res.status(401).json({
          error: "invalid_token",
          error_description: "Token validation failed",
        });
        return;
      }

      // Proceed to tenant validation for multi-tenant
      validateTenant(req, res, next);
    });
  };
}

/**
 * Export a singleton instance of the bearer auth middleware.
 */
export const bearerAuth = createBearerAuthMiddleware();
