import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolResult,
  CreateMessageRequest,
  CreateMessageResultWithToolsSchema,
  CreateMessageResultSchema,
  Tool,
  ToolChoice,
  SamplingMessage,
  ToolUseContent,
} from "@modelcontextprotocol/sdk/types.js";
import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Tool input schema
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

// Sample tools for demonstration
const sampleTools: Tool[] = [
  {
    name: "get_weather",
    description: "Get current weather for a city",
    inputSchema: {
      type: "object" as const,
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
      type: "object" as const,
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
      type: "object" as const,
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

/**
 * Execute a mock tool and return a simulated result
 */
function executeMockTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_weather": {
      const conditions = ["sunny", "cloudy", "rainy", "partly cloudy"];
      return JSON.stringify({
        city: input.city,
        temperature: Math.floor(Math.random() * 30) + 5,
        conditions: conditions[Math.floor(Math.random() * conditions.length)],
        humidity: Math.floor(Math.random() * 60) + 40,
      });
    }
    case "calculate": {
      try {
        // Safe evaluation using basic parsing
        const expr = String(input.expression);
        // Only allow digits, operators, parentheses, and decimal points
        if (!/^[\d+\-*/().%\s]+$/.test(expr)) {
          return `Error: Invalid expression. Only basic math operations allowed.`;
        }
        // Use Function constructor with strict mode
        const result = Function(`"use strict"; return (${expr})`)();
        return `Result: ${result}`;
      } catch {
        return `Error: Could not evaluate expression`;
      }
    }
    case "get_time": {
      try {
        const timezone = String(input.timezone);
        return new Date().toLocaleString("en-US", { timeZone: timezone });
      } catch {
        return `Error: Invalid timezone`;
      }
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

/**
 * Extract tool use content blocks from a response
 */
function extractToolCalls(
  content: SamplingMessage["content"]
): ToolUseContent[] {
  if (Array.isArray(content)) {
    return content.filter((c): c is ToolUseContent => c.type === "tool_use");
  }
  if (content.type === "tool_use") {
    return [content as ToolUseContent];
  }
  return [];
}

// Tool configuration
const name = "trigger-enhanced-sampling";
const config = {
  title: "Trigger Enhanced Sampling with Tools",
  description:
    "Demonstrates server-side agent loop with tool calling in sampling requests",
  inputSchema: TriggerEnhancedSamplingSchema,
};

/**
 * Registers the 'trigger-enhanced-sampling' tool.
 *
 * This tool demonstrates enhanced sampling capabilities including:
 * - Tool definitions in sampling requests
 * - Tool choice modes (auto, required, none)
 * - Server-side agent loop pattern with tool execution
 * - Parallel tool call handling
 *
 * @param {McpServer} server - The McpServer instance where the tool will be registered.
 */
export const registerTriggerEnhancedSamplingTool = (server: McpServer) => {
  // Check client capabilities
  const clientCapabilities = server.server.getClientCapabilities() || {};
  const clientSupportsSampling: boolean =
    clientCapabilities.sampling !== undefined;

  // Only register if client supports sampling
  if (!clientSupportsSampling) {
    return;
  }

  server.registerTool(
    name,
    config,
    async (args, extra): Promise<CallToolResult> => {
      const validatedArgs = TriggerEnhancedSamplingSchema.parse(args);
      const {
        prompt,
        maxTokens,
        systemPrompt,
        includeTools,
        toolChoice,
        maxIterations,
      } = validatedArgs;

      if (!includeTools) {
        // Basic sampling without tools (similar to existing tool)
        const request: CreateMessageRequest = {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: { type: "text", text: prompt },
              },
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
              text: `Sampling Result (no tools):\n${JSON.stringify(
                result,
                null,
                2
              )}`,
            },
          ],
        };
      }

      // Agent loop with tools
      const conversationHistory: SamplingMessage[] = [
        {
          role: "user",
          content: { type: "text", text: prompt },
        },
      ];

      const iterationResults: Array<{
        iteration: number;
        stopReason?: string;
        toolCalls?: Array<{ name: string; input: unknown; result: string }>;
        textResponse?: string;
      }> = [];

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Force no tools on last iteration to get a final answer
        const currentToolChoice: ToolChoice =
          iteration === maxIterations - 1
            ? { mode: "none" }
            : { mode: toolChoice };

        const request: CreateMessageRequest = {
          method: "sampling/createMessage",
          params: {
            messages: conversationHistory,
            systemPrompt:
              systemPrompt ||
              "You are a helpful assistant with access to tools. Use them when needed to answer questions accurately.",
            maxTokens,
            tools: iteration === maxIterations - 1 ? undefined : sampleTools,
            toolChoice:
              iteration === maxIterations - 1 ? undefined : currentToolChoice,
          },
        };

        // Use the appropriate schema based on whether tools are included
        const result = await extra.sendRequest(
          request,
          iteration === maxIterations - 1
            ? CreateMessageResultSchema
            : CreateMessageResultWithToolsSchema
        );

        const iterationResult: (typeof iterationResults)[number] = {
          iteration: iteration + 1,
          stopReason: result.stopReason,
        };

        // Check if the model wants to use tools
        if (result.stopReason === "toolUse") {
          const toolCalls = extractToolCalls(result.content);

          if (toolCalls.length > 0) {
            // Add assistant's tool use message to history
            conversationHistory.push({
              role: "assistant",
              content: result.content,
            });

            // Execute all tool calls (parallel execution)
            const toolResults: Array<{
              name: string;
              input: unknown;
              result: string;
            }> = [];

            const toolResultContent: Array<{
              type: "tool_result";
              toolUseId: string;
              content: Array<{ type: "text"; text: string }>;
            }> = [];

            for (const toolCall of toolCalls) {
              const toolResult = executeMockTool(
                toolCall.name,
                toolCall.input as Record<string, unknown>
              );
              toolResults.push({
                name: toolCall.name,
                input: toolCall.input,
                result: toolResult,
              });
              toolResultContent.push({
                type: "tool_result",
                toolUseId: toolCall.id,
                content: [{ type: "text", text: toolResult }],
              });
            }

            // Add tool results to conversation history
            conversationHistory.push({
              role: "user",
              content: toolResultContent as SamplingMessage["content"],
            });

            iterationResult.toolCalls = toolResults;
            iterationResults.push(iterationResult);
            continue;
          }
        }

        // End of conversation - extract text response
        let textResponse = "";
        if (Array.isArray(result.content)) {
          const textBlocks = result.content.filter((c) => c.type === "text");
          textResponse = textBlocks
            .map((b) => ("text" in b ? b.text : ""))
            .join("\n");
        } else if (result.content.type === "text") {
          textResponse = result.content.text;
        }

        iterationResult.textResponse = textResponse;
        iterationResults.push(iterationResult);
        break;
      }

      // Format final response
      const lastResult = iterationResults[iterationResults.length - 1];
      const finalResponse = lastResult?.textResponse || "No final response";

      return {
        content: [
          {
            type: "text",
            text: [
              "=== Enhanced Sampling Agent Loop Result ===",
              "",
              `Total Iterations: ${iterationResults.length}`,
              `Tool Choice Mode: ${toolChoice}`,
              "",
              "--- Iteration Details ---",
              ...iterationResults.map((r) => {
                const lines = [`Iteration ${r.iteration}:`];
                lines.push(`  Stop Reason: ${r.stopReason || "N/A"}`);
                if (r.toolCalls) {
                  lines.push(`  Tool Calls:`);
                  for (const tc of r.toolCalls) {
                    lines.push(`    - ${tc.name}(${JSON.stringify(tc.input)})`);
                    lines.push(`      Result: ${tc.result}`);
                  }
                }
                if (r.textResponse) {
                  lines.push(
                    `  Response: ${r.textResponse.substring(0, 200)}${
                      r.textResponse.length > 200 ? "..." : ""
                    }`
                  );
                }
                return lines.join("\n");
              }),
              "",
              "--- Final Response ---",
              finalResponse,
            ].join("\n"),
          },
        ],
      };
    }
  );
};
