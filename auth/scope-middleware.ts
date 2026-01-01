import { Response, NextFunction, RequestHandler } from "express";
import { AuthenticatedRequest } from "./jwt-middleware.js";
import { oauthConfig } from "./config.js";

/**
 * Build WWW-Authenticate header for scope errors.
 */
function buildScopeErrorHeader(requiredScopes: string[]): string {
  const { mcpServerUrl } = oauthConfig;
  const resourceMetadataUrl = `${mcpServerUrl}/.well-known/oauth-protected-resource`;

  return (
    `Bearer resource_metadata="${resourceMetadataUrl}", ` +
    `error="insufficient_scope", ` +
    `scope="${requiredScopes.join(" ")}"`
  );
}

/**
 * Create middleware that requires specific scopes or roles.
 * The token must have at least one of the required scopes/roles.
 *
 * @param requiredScopes - Array of scope/role names (any match passes)
 */
export function requireScope(requiredScopes: string[]): RequestHandler {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.auth) {
      res.status(401).json({
        error: "invalid_token",
        error_description: "No authentication context available",
      });
      return;
    }

    // Delegated tokens have 'scp', application tokens have 'roles'
    const tokenScopes = req.auth.scp?.split(" ") || [];
    const tokenRoles = req.auth.roles || [];
    const allPermissions = [...tokenScopes, ...tokenRoles];

    // Check if token has any of the required scopes/roles
    const hasRequiredScope = requiredScopes.some((scope) =>
      allPermissions.includes(scope)
    );

    if (!hasRequiredScope) {
      // Return 403 with scope requirement for insufficient scope
      res.set("WWW-Authenticate", buildScopeErrorHeader(requiredScopes));
      res.status(403).json({
        error: "insufficient_scope",
        error_description: `Required scope: ${requiredScopes.join(" or ")}`,
        required_scopes: requiredScopes,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require delegated tokens (user context) vs application tokens.
 * Delegated tokens have 'scp' claim; application tokens have 'roles'.
 */
export const requireDelegatedToken: RequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth?.scp) {
    res.status(403).json({
      error: "invalid_token_type",
      error_description:
        "This endpoint requires a delegated access token (user context)",
    });
    return;
  }
  next();
};

/**
 * Middleware to require application tokens (service-to-service).
 * Application tokens have 'roles' claim without 'scp'.
 */
export const requireApplicationToken: RequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth?.roles || req.auth.roles.length === 0) {
    res.status(403).json({
      error: "invalid_token_type",
      error_description: "This endpoint requires an application access token",
    });
    return;
  }
  next();
};

/**
 * Default scopes required for MCP tool access.
 */
export const MCP_TOOL_SCOPES = ["mcp:tools", "Mcp.Execute.All"];

/**
 * Default scopes required for MCP resource access.
 */
export const MCP_RESOURCE_SCOPES = ["mcp:resources", "Mcp.Read.All"];

/**
 * Admin scopes for administrative operations.
 */
export const MCP_ADMIN_SCOPES = ["mcp:admin", "Mcp.Admin.All"];
