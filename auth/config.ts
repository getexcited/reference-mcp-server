import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * OAuth configuration loaded from environment variables.
 * Resource servers do not require client secrets - they only validate tokens.
 */
export interface OAuthConfig {
  // Entra ID Configuration
  entraClientId: string;
  entraTenantId: string;

  // MCP Server Configuration
  mcpServerUrl: string;
  mcpResourceIdentifier: string;

  // Multi-tenant Configuration
  authorizedTenants: string[];
  allowAnyTenant: boolean;

  // Server Configuration
  port: number;
  nodeEnv: string;
  allowedOrigins: string[];

  // Feature Toggle
  oauthEnabled: boolean;
}

/**
 * Load OAuth configuration from environment variables.
 * Throws if required variables are missing when OAuth is enabled.
 */
export function loadOAuthConfig(): OAuthConfig {
  const oauthEnabled = process.env.OAUTH_ENABLED !== "false";

  const entraClientId = process.env.ENTRA_CLIENT_ID || "";
  const entraTenantId = process.env.ENTRA_TENANT_ID || "";
  const mcpServerUrl =
    process.env.MCP_SERVER_URL ||
    `http://localhost:${process.env.PORT || 3001}`;
  const mcpResourceIdentifier =
    process.env.MCP_RESOURCE_IDENTIFIER || mcpServerUrl;

  const authorizedTenants =
    process.env.AUTHORIZED_TENANTS?.split(",")
      .map((t) => t.trim())
      .filter(Boolean) || [];
  const allowAnyTenant =
    authorizedTenants.includes("common") || authorizedTenants.length === 0;

  const port = parseInt(process.env.PORT || "3001", 10);
  const nodeEnv = process.env.NODE_ENV || "development";
  const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || "*";
  const allowedOrigins =
    allowedOriginsRaw === "*"
      ? ["*"]
      : allowedOriginsRaw.split(",").map((o) => o.trim());

  // Validate required config when OAuth is enabled
  if (oauthEnabled) {
    const missing: string[] = [];
    if (!entraClientId) missing.push("ENTRA_CLIENT_ID");
    if (!entraTenantId && !allowAnyTenant)
      missing.push("ENTRA_TENANT_ID (or set AUTHORIZED_TENANTS=common)");

    if (missing.length > 0) {
      console.warn(
        `[OAuth] Warning: Missing configuration: ${missing.join(", ")}. ` +
          `OAuth validation will fail until these are configured.`
      );
    }
  }

  return {
    entraClientId,
    entraTenantId,
    mcpServerUrl,
    mcpResourceIdentifier,
    authorizedTenants,
    allowAnyTenant,
    port,
    nodeEnv,
    allowedOrigins,
    oauthEnabled,
  };
}

// Export singleton config instance
export const oauthConfig = loadOAuthConfig();
