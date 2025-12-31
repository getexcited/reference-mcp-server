/**
 * Server Metadata Module
 *
 * Provides server identity document and protected resource metadata
 * for MCP server discovery (RFC 9728 compatible).
 */

/**
 * MCP Server Identity Document
 * Returned at /.well-known/mcp.json for server discovery
 */
export interface ServerIdentityDocument {
  mcp_version: string;
  server_name: string;
  server_version: string;
  server_title?: string;
  description?: string;
  endpoints?: {
    stdio?: boolean;
    sse?: string;
    streamable_http?: string;
  };
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    sampling: boolean;
    logging: boolean;
    roots: boolean;
    elicitation: boolean;
  };
  documentation?: string;
  repository?: string;
  homepage?: string;
}

/**
 * OAuth Protected Resource Metadata (RFC 9728)
 * Returned at /.well-known/oauth-protected-resource
 */
export interface ProtectedResourceMetadata {
  resource: string;
  resource_name?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
}

/**
 * Get the server identity document for MCP discovery
 *
 * @param baseUrl - Optional base URL for endpoint URLs
 * @returns Server identity document
 */
export function getServerIdentityDocument(
  baseUrl?: string
): ServerIdentityDocument {
  return {
    mcp_version: "2025-11-25",
    server_name: "mcp-servers/everything",
    server_version: "2.0.0",
    server_title: "Everything Reference Server",
    description:
      "MCP reference server that exercises all protocol features for testing MCP clients",
    endpoints: {
      stdio: true,
      ...(baseUrl && {
        sse: `${baseUrl}/sse`,
        streamable_http: `${baseUrl}/mcp`,
      }),
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      sampling: true,
      logging: true,
      roots: true,
      elicitation: true,
    },
    documentation: "https://github.com/modelcontextprotocol/servers",
    repository: "https://github.com/modelcontextprotocol/servers",
    homepage: "https://modelcontextprotocol.io",
  };
}

/**
 * Get the OAuth protected resource metadata (RFC 9728)
 *
 * @param baseUrl - Base URL for the resource
 * @returns Protected resource metadata
 */
export function getProtectedResourceMetadata(
  baseUrl: string
): ProtectedResourceMetadata {
  return {
    resource: baseUrl,
    resource_name: "Everything Reference Server",
    // No authorization servers - this reference server supports optional auth
    // Real implementations would include:
    // authorization_servers: ["https://auth.example.com"],
    // scopes_supported: ["mcp:tools", "mcp:resources", "mcp:prompts"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://github.com/modelcontextprotocol/servers",
  };
}
