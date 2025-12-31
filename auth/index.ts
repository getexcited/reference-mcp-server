/**
 * OAuth 2.1 Authentication Module for MCP Server
 *
 * Implements OAuth 2.1 resource server functionality per MCP Authorization Specification (2025-11-25).
 * Uses Microsoft Entra ID as the authorization server.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-11-05/basic/authorization/
 */

// Configuration
export { oauthConfig, loadOAuthConfig, type OAuthConfig } from "./config.js";

// Protected Resource Metadata (RFC 9728)
export {
  createMetadataRouter,
  buildProtectedResourceMetadata,
  type ProtectedResourceMetadata,
} from "./metadata.js";

// JWT Validation Middleware
export {
  bearerAuth,
  createBearerAuthMiddleware,
  validateTenant,
  type AuthenticatedRequest,
} from "./jwt-middleware.js";

// Scope Validation Middleware
export {
  requireScope,
  requireDelegatedToken,
  requireApplicationToken,
  MCP_TOOL_SCOPES,
  MCP_RESOURCE_SCOPES,
  MCP_ADMIN_SCOPES,
} from "./scope-middleware.js";

// Security Headers
export { securityHeaders } from "./security-headers.js";

// Error Handlers
export { handleAuthError, handleGeneralError, logAuthEvent } from "./error-handlers.js";

// Rate Limiting
export { metadataLimiter, apiLimiter } from "./rate-limiter.js";
