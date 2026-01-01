# Implementation Plan: Enhanced Sampling & Server Discovery

This plan adds November 2025 MCP spec features to the reference server.

---

## Feature 1: Enhanced Sampling with Tool Calling

### Overview

Extend the existing `trigger-sampling-request` tool to support:

- Tool definitions in sampling requests
- Tool choice modes (auto, required, none)
- Server-side agent loop pattern with tool execution
- Parallel tool call handling

### Implementation Steps

#### Step 1: Create Enhanced Sampling Tool Schema

**File:** `tools/trigger-enhanced-sampling.ts` (new)

Define expanded input schema:

```typescript
const TriggerEnhancedSamplingSchema = z.object({
  prompt: z.string().describe("The prompt to send to the LLM"),
  maxTokens: z.number().default(1000).describe("Maximum tokens to generate"),
  systemPrompt: z.string().optional().describe("System prompt for the LLM"),
  includeTools: z
    .boolean()
    .default(false)
    .describe("Include sample tools in request"),
  toolChoice: z
    .enum(["auto", "required", "none"])
    .default("auto")
    .describe("Tool choice mode"),
  maxIterations: z.number().default(5).describe("Max agent loop iterations"),
});
```

#### Step 2: Define Sample Tools for Demonstration

**File:** `tools/trigger-enhanced-sampling.ts`

Create demonstrable tool definitions:

```typescript
const sampleTools: Tool[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
  {
    name: "calculate",
    description: "Perform a mathematical calculation",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "Math expression to evaluate",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "get_time",
    description: "Get current time in a timezone",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA timezone (e.g., America/New_York)",
        },
      },
      required: ["timezone"],
    },
  },
];
```

#### Step 3: Implement Mock Tool Executor

**File:** `tools/trigger-enhanced-sampling.ts`

```typescript
async function executeMockTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "get_weather":
      return JSON.stringify({
        city: input.city,
        temperature: Math.floor(Math.random() * 30) + 5,
        conditions: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
        humidity: Math.floor(Math.random() * 60) + 40,
      });
    case "calculate":
      try {
        // Safe eval for demo - production would use proper math parser
        const result = Function(`"use strict"; return (${input.expression})`)();
        return `Result: ${result}`;
      } catch {
        return `Error: Could not evaluate expression`;
      }
    case "get_time":
      return new Date().toLocaleString("en-US", {
        timeZone: input.timezone as string,
      });
    default:
      return `Unknown tool: ${name}`;
  }
}
```

#### Step 4: Implement Agent Loop Logic

**File:** `tools/trigger-enhanced-sampling.ts`

```typescript
async function runAgentLoop(
  extra: ToolCallbackExtra,
  initialPrompt: string,
  systemPrompt: string,
  tools: Tool[],
  toolChoice: ToolChoice,
  maxTokens: number,
  maxIterations: number
): Promise<{ messages: SamplingMessage[]; finalResponse: string }> {
  const messages: SamplingMessage[] = [
    {
      role: "user",
      content: { type: "text", text: initialPrompt },
    },
  ];

  for (let i = 0; i < maxIterations; i++) {
    // Force completion on final iteration
    const currentToolChoice =
      i === maxIterations - 1 ? { mode: "none" as const } : toolChoice;

    const request: CreateMessageRequest = {
      method: "sampling/createMessage",
      params: {
        messages,
        systemPrompt,
        maxTokens,
        tools,
        toolChoice: currentToolChoice,
      },
    };

    const result = await extra.sendRequest(request, CreateMessageResultSchema);

    if (result.stopReason === "toolUse") {
      // Handle tool calls
      const content = Array.isArray(result.content)
        ? result.content
        : [result.content];
      const toolCalls = content.filter((c) => c.type === "tool_use");

      messages.push({ role: "assistant", content: result.content });

      // Execute tools and collect results
      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => ({
          type: "tool_result" as const,
          toolUseId: tc.id,
          content: [
            {
              type: "text" as const,
              text: await executeMockTool(tc.name, tc.input),
            },
          ],
        }))
      );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Final response
    const text =
      result.content.type === "text"
        ? result.content.text
        : JSON.stringify(result.content);
    return { messages, finalResponse: text };
  }

  return { messages, finalResponse: "Max iterations reached" };
}
```

#### Step 5: Register Enhanced Sampling Tool

**File:** `tools/trigger-enhanced-sampling.ts`

```typescript
export const registerTriggerEnhancedSamplingTool = (server: McpServer) => {
  const clientCapabilities = server.server.getClientCapabilities() || {};
  const clientSupportsToolsInSampling =
    clientCapabilities.sampling?.tools !== undefined;
  const clientSupportsSampling = clientCapabilities.sampling !== undefined;

  if (clientSupportsSampling) {
    server.registerTool(
      "trigger-enhanced-sampling",
      {
        title: "Trigger Enhanced Sampling with Tools",
        description: clientSupportsToolsInSampling
          ? "Demonstrates server-side agent loop with tool calling in sampling requests"
          : "Tool calling not supported by client - falls back to basic sampling",
        inputSchema: TriggerEnhancedSamplingSchema,
      },
      async (args, extra): Promise<CallToolResult> => {
        const {
          prompt,
          maxTokens,
          systemPrompt,
          includeTools,
          toolChoice,
          maxIterations,
        } = TriggerEnhancedSamplingSchema.parse(args);

        if (includeTools && !clientSupportsToolsInSampling) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Client does not support tools in sampling requests. Set includeTools=false.",
              },
            ],
          };
        }

        if (includeTools) {
          const result = await runAgentLoop(
            extra,
            prompt,
            systemPrompt || "You are a helpful assistant with access to tools.",
            sampleTools,
            { mode: toolChoice },
            maxTokens,
            maxIterations
          );

          return {
            content: [
              {
                type: "text",
                text: `Agent Loop Result:\n\nIterations: ${
                  result.messages.length
                }\n\nFinal Response:\n${
                  result.finalResponse
                }\n\nFull Conversation:\n${JSON.stringify(
                  result.messages,
                  null,
                  2
                )}`,
              },
            ],
          };
        } else {
          // Basic sampling without tools (existing behavior)
          const request: CreateMessageRequest = {
            method: "sampling/createMessage",
            params: {
              messages: [
                { role: "user", content: { type: "text", text: prompt } },
              ],
              systemPrompt: systemPrompt || "You are a helpful assistant.",
              maxTokens,
            },
          };

          const result = await extra.sendRequest(
            request,
            CreateMessageResultSchema
          );
          return {
            content: [
              {
                type: "text",
                text: `Sampling Result:\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        }
      }
    );
  }
};
```

#### Step 6: Update Tools Index

**File:** `tools/index.ts`

Add import and registration:

```typescript
import { registerTriggerEnhancedSamplingTool } from "./trigger-enhanced-sampling.js";

export const registerConditionalTools = (server: McpServer) => {
  registerGetRootsListTool(server);
  registerTriggerElicitationRequestTool(server);
  registerTriggerSamplingRequestTool(server);
  registerTriggerEnhancedSamplingTool(server); // Add this
};
```

---

## Feature 2: Server Discovery

### Overview

Add `.well-known` endpoints for server discovery:

- `/.well-known/mcp.json` - Server identity document
- `/.well-known/oauth-protected-resource` - OAuth metadata (for authenticated servers)

### Implementation Steps

#### Step 1: Create Server Metadata Module

**File:** `server/metadata.ts` (new)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

export interface ProtectedResourceMetadata {
  resource: string;
  resource_name?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
}

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

export function getProtectedResourceMetadata(
  baseUrl: string
): ProtectedResourceMetadata {
  return {
    resource: baseUrl,
    resource_name: "Everything Reference Server",
    // No authorization servers - this reference server doesn't require auth
    // Real implementations would include:
    // authorization_servers: ["https://auth.example.com"],
    // scopes_supported: ["mcp:tools", "mcp:resources", "mcp:prompts"],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://github.com/modelcontextprotocol/servers",
  };
}
```

#### Step 2: Create Discovery Routes Module

**File:** `server/discovery.ts` (new)

```typescript
import { Router, Request, Response } from "express";
import {
  getServerIdentityDocument,
  getProtectedResourceMetadata,
} from "./metadata.js";

export function createDiscoveryRouter(baseUrl?: string): Router {
  const router = Router();

  // Server identity document
  router.get("/.well-known/mcp.json", (req: Request, res: Response) => {
    const effectiveBaseUrl = baseUrl || `${req.protocol}://${req.get("host")}`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.json(getServerIdentityDocument(effectiveBaseUrl));
  });

  // OAuth protected resource metadata (RFC 9728)
  router.get(
    "/.well-known/oauth-protected-resource",
    (req: Request, res: Response) => {
      const effectiveBaseUrl =
        baseUrl || `${req.protocol}://${req.get("host")}`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");

      res.json(getProtectedResourceMetadata(effectiveBaseUrl));
    }
  );

  // Alternative path for mcp discovery
  router.get("/.well-known/mcp", (req: Request, res: Response) => {
    const effectiveBaseUrl = baseUrl || `${req.protocol}://${req.get("host")}`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "max-age=3600");

    res.json(getServerIdentityDocument(effectiveBaseUrl));
  });

  return router;
}
```

#### Step 3: Update Streamable HTTP Transport

**File:** `transports/streamableHttp.ts`

Add discovery routes to Express app:

```typescript
import { createDiscoveryRouter } from "../server/discovery.js";

// After CORS setup, before MCP routes
const baseUrl = process.env.BASE_URL; // Optional: explicit base URL
app.use(createDiscoveryRouter(baseUrl));
```

#### Step 4: Update SSE Transport

**File:** `transports/sse.ts`

Add same discovery routes:

```typescript
import { createDiscoveryRouter } from "../server/discovery.js";

// After CORS setup, before SSE routes
app.use(createDiscoveryRouter());
```

#### Step 5: Create Discovery Test Tool

**File:** `tools/get-server-identity.ts` (new)

Tool that returns the server's own identity document:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getServerIdentityDocument } from "../server/metadata.js";

const GetServerIdentitySchema = z.object({
  baseUrl: z
    .string()
    .optional()
    .describe("Base URL for endpoint URLs (optional)"),
});

export const registerGetServerIdentityTool = (server: McpServer) => {
  server.registerTool(
    "get-server-identity",
    {
      title: "Get Server Identity",
      description: "Returns this server's MCP identity document for discovery",
      inputSchema: GetServerIdentitySchema,
    },
    async (args): Promise<CallToolResult> => {
      const { baseUrl } = GetServerIdentitySchema.parse(args);
      const identity = getServerIdentityDocument(baseUrl);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(identity, null, 2),
          },
        ],
        structuredContent: identity,
      };
    }
  );
};
```

#### Step 6: Update Tools Index for Discovery Tool

**File:** `tools/index.ts`

```typescript
import { registerGetServerIdentityTool } from "./get-server-identity.js";

export const registerTools = (server: McpServer) => {
  // ... existing tools ...
  registerGetServerIdentityTool(server); // Add this
};
```

---

## File Summary

### New Files

| File                                 | Purpose                                    |
| ------------------------------------ | ------------------------------------------ |
| `tools/trigger-enhanced-sampling.ts` | Enhanced sampling with tool calling        |
| `tools/get-server-identity.ts`       | Tool to expose server identity             |
| `server/metadata.ts`                 | Server identity/metadata definitions       |
| `server/discovery.ts`                | Express router for `.well-known` endpoints |

### Modified Files

| File                           | Changes                       |
| ------------------------------ | ----------------------------- |
| `tools/index.ts`               | Import and register new tools |
| `transports/streamableHttp.ts` | Add discovery router          |
| `transports/sse.ts`            | Add discovery router          |

---

## Testing Checklist

### Enhanced Sampling

- [ ] Basic sampling still works without tools
- [ ] Tool definitions included in sampling request
- [ ] Tool choice modes work (auto, required, none)
- [ ] Agent loop executes multiple iterations
- [ ] Parallel tool calls handled correctly
- [ ] Graceful fallback when client doesn't support tools in sampling
- [ ] Max iterations limit respected

### Server Discovery

- [ ] `GET /.well-known/mcp.json` returns valid identity document
- [ ] `GET /.well-known/mcp` returns same document
- [ ] `GET /.well-known/oauth-protected-resource` returns metadata
- [ ] Correct Content-Type and Cache-Control headers
- [ ] CORS allows cross-origin access
- [ ] `get-server-identity` tool returns identity document
- [ ] Endpoints dynamically include correct base URL

---

## Dependencies

No new dependencies required. Uses existing:

- `@modelcontextprotocol/sdk` (existing)
- `express` (existing)
- `zod` (existing)

---

## Estimated Effort

| Task                   | Complexity |
| ---------------------- | ---------- |
| Enhanced Sampling Tool | Medium     |
| Agent Loop Logic       | Medium     |
| Server Metadata Module | Low        |
| Discovery Routes       | Low        |
| Transport Updates      | Low        |
| Testing                | Medium     |

**Total:** ~4-6 hours of implementation
