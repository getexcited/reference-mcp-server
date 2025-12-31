import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getServerIdentityDocument } from "../server/metadata.js";

// Tool input schema
const GetServerIdentitySchema = z.object({
  baseUrl: z
    .string()
    .optional()
    .describe("Base URL for endpoint URLs (optional)"),
});

// Tool configuration
const name = "get-server-identity";
const config = {
  title: "Get Server Identity",
  description:
    "Returns this server's MCP identity document for discovery purposes",
  inputSchema: GetServerIdentitySchema,
};

/**
 * Registers the 'get-server-identity' tool.
 *
 * This tool returns the server's identity document which contains:
 * - MCP version
 * - Server name, version, and title
 * - Description
 * - Available endpoints (stdio, SSE, streamable HTTP)
 * - Supported capabilities (tools, resources, prompts, etc.)
 * - Documentation, repository, and homepage links
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 */
export const registerGetServerIdentityTool = (server: McpServer) => {
  server.registerTool(name, config, async (args): Promise<CallToolResult> => {
    const { baseUrl } = GetServerIdentitySchema.parse(args);
    const identity = getServerIdentityDocument(baseUrl);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(identity, null, 2),
        },
      ],
      structuredContent: identity as unknown as Record<string, unknown>,
    };
  });
};
