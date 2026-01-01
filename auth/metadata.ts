import { Request, Response, Router } from "express";
import { oauthConfig } from "./config.js";

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 * This is the entry point for MCP client discovery.
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */
export interface ProtectedResourceMetadata {
  // The resource identifier - used in RFC 8707 resource parameter
  resource: string;

  // Authorization server(s) that can issue valid tokens
  authorization_servers: string[];

  // How bearer tokens should be transmitted
  bearer_methods_supported: string[];

  // Scopes this resource server understands
  scopes_supported: string[];

  // Optional: documentation URL
  resource_documentation?: string;
}

/**
 * Build the Protected Resource Metadata response.
 */
export function buildProtectedResourceMetadata(): ProtectedResourceMetadata {
  const {
    mcpServerUrl,
    mcpResourceIdentifier,
    entraClientId,
    entraTenantId,
    allowAnyTenant,
  } = oauthConfig;

  // For multi-tenant: use 'common' endpoint, then validate tid claim
  // For single-tenant: use the specific tenant ID
  const tenantPath = allowAnyTenant ? "common" : entraTenantId;

  return {
    resource: mcpResourceIdentifier || mcpServerUrl,
    authorization_servers: [
      `https://login.microsoftonline.com/${tenantPath}/v2.0`,
    ],
    bearer_methods_supported: ["header"],
    scopes_supported: [
      `api://${entraClientId}/mcp:tools`,
      `api://${entraClientId}/mcp:resources`,
    ],
    resource_documentation: `${mcpServerUrl}/docs`,
  };
}

/**
 * Create a router with the OAuth metadata endpoints.
 */
export function createMetadataRouter(): Router {
  const router = Router();

  // OAuth Protected Resource Metadata (RFC 9728)
  // This is the entry point for MCP client discovery
  router.get(
    "/.well-known/oauth-protected-resource",
    (_req: Request, res: Response) => {
      const metadata = buildProtectedResourceMetadata();
      res.json(metadata);
    }
  );

  // Authorization Server Metadata proxy (optional, not recommended for production)
  // Clients should fetch directly from Entra ID
  router.get(
    "/.well-known/oauth-authorization-server",
    async (req: Request, res: Response) => {
      try {
        const { entraTenantId, allowAnyTenant } = oauthConfig;

        // Determine which tenant's metadata to fetch
        const tenantId = (req.query.tenant as string) || entraTenantId;
        const tenantPath = allowAnyTenant && !tenantId ? "common" : tenantId;

        // Entra ID uses openid-configuration, not oauth-authorization-server
        const metadataUrl = `https://login.microsoftonline.com/${tenantPath}/v2.0/.well-known/openid-configuration`;

        const response = await fetch(metadataUrl, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Entra ID returned ${response.status}`);
        }

        const metadata = await response.json();

        // Do not cache - return with no-store directive
        res.set("Cache-Control", "no-store");
        res.json(metadata);
      } catch (error) {
        console.error("Failed to fetch authorization server metadata:", error);
        res.status(502).json({
          error: "server_error",
          error_description: "Failed to fetch authorization server metadata",
        });
      }
    }
  );

  return router;
}
