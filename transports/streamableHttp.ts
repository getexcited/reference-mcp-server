import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import express, { Request, Response } from "express";
import { createServer } from "../server/index.js";
import { randomUUID } from "node:crypto";
import cors from "cors";
import {
  oauthConfig,
  createMetadataRouter,
  bearerAuth,
  requireScope,
  securityHeaders,
  handleAuthError,
  handleGeneralError,
  metadataLimiter,
  apiLimiter,
  MCP_TOOL_SCOPES,
  type AuthenticatedRequest,
} from "../auth/index.js";
import { createDiscoveryRouter } from "../server/discovery.js";

console.log("Starting Streamable HTTP server...");

// Express app with permissive CORS for testing with Inspector direct connect mode
const app = express();

// Security headers for all responses
app.use(securityHeaders);

app.use(
  cors({
    origin: oauthConfig.allowedOrigins.includes("*")
      ? "*"
      : oauthConfig.allowedOrigins,
    methods: "GET,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    exposedHeaders: [
      "mcp-session-id",
      "last-event-id",
      "mcp-protocol-version",
      "WWW-Authenticate",
    ],
  })
);

// Rate limiting for metadata endpoints
app.use("/.well-known", metadataLimiter);

// OAuth metadata endpoints (RFC 9728)
app.use(createMetadataRouter());

// MCP discovery endpoints (server identity document)
app.use(createDiscoveryRouter());

// Map sessionId to server transport for each client
const transports: Map<string, StreamableHTTPServerTransport> = new Map<
  string,
  StreamableHTTPServerTransport
>();

/**
 * Middleware stack for protected MCP endpoints.
 * When OAuth is disabled, endpoints are unprotected (for development).
 */
const protectedMiddleware = oauthConfig.oauthEnabled
  ? [apiLimiter, bearerAuth, requireScope(MCP_TOOL_SCOPES)]
  : [apiLimiter];

// Handle POST requests for client messages
app.post(
  "/mcp",
  ...protectedMiddleware,
  async (req: Request, res: Response) => {
    console.log("Received MCP POST request");
    try {
      // Check for existing session ID
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        // Reuse existing transport
        transport = transports.get(sessionId)!;
      } else if (!sessionId) {
        const { server, cleanup } = createServer();

        // New initialization request
        const eventStore = new InMemoryEventStore();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore, // Enable resumability
          onsessioninitialized: (sessionId: string) => {
            // Store the transport by session ID when a session is initialized
            // This avoids race conditions where requests might come in before the session is stored
            console.log(`Session initialized with ID: ${sessionId}`);
            transports.set(sessionId, transport);

            // Log auth event if OAuth is enabled
            if (oauthConfig.oauthEnabled) {
              const authReq = req as AuthenticatedRequest;
              console.log(
                JSON.stringify({
                  event: "session_initialized",
                  sessionId,
                  tenantId: authReq.auth?.tid,
                  userId: authReq.auth?.sub,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          },
        });

        // Set up onclose handler to clean up transport when closed
        server.server.onclose = async () => {
          const sid = transport.sessionId;
          if (sid && transports.has(sid)) {
            console.log(
              `Transport closed for session ${sid}, removing from transports map`
            );
            transports.delete(sid);
            cleanup(sid);
          }
        };

        // Connect the transport to the MCP server BEFORE handling the request
        // so responses can flow back through the same transport
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      } else {
        // Invalid request - no session ID or not initialization request
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: req?.body?.id,
        });
        return;
      }

      // Handle the request with existing transport - no need to reconnect
      // The existing transport is already connected to the server
      await transport.handleRequest(req, res);
    } catch (error) {
      console.log("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: req?.body?.id,
        });
        return;
      }
    }
  }
);

// Handle GET requests for SSE streams
app.get("/mcp", ...protectedMiddleware, async (req: Request, res: Response) => {
  console.log("Received MCP GET request");
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: req?.body?.id,
    });
    return;
  }

  // Check for Last-Event-ID header for resumability
  const lastEventId = req.headers["last-event-id"] as string | undefined;
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`);
  }

  const transport = transports.get(sessionId);
  await transport!.handleRequest(req, res);
});

// Handle DELETE requests for session termination
app.delete(
  "/mcp",
  ...protectedMiddleware,
  async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: req?.body?.id,
      });
      return;
    }

    console.log(
      `Received session termination request for session ${sessionId}`
    );

    try {
      const transport = transports.get(sessionId);
      await transport!.handleRequest(req, res);
    } catch (error) {
      console.log("Error handling session termination:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Error handling session termination",
          },
          id: req?.body?.id,
        });
        return;
      }
    }
  }
);

// Error handlers
app.use(handleAuthError);
app.use(handleGeneralError);

// Start the server
const PORT = oauthConfig.port;
const server = app.listen(PORT, () => {
  console.error(`MCP Streamable HTTP Server listening on port ${PORT}`);
  console.error(`OAuth enabled: ${oauthConfig.oauthEnabled}`);
  if (oauthConfig.oauthEnabled) {
    console.error(
      `Protected Resource Metadata: ${oauthConfig.mcpServerUrl}/.well-known/oauth-protected-resource`
    );
  }
});

// Handle server errors
server.on("error", (err: unknown) => {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;
  if (code === "EADDRINUSE") {
    console.error(
      `Failed to start: Port ${PORT} is already in use. Set PORT to a free port or stop the conflicting process.`
    );
  } else {
    console.error("HTTP server encountered an error while starting:", err);
  }
  // Ensure a non-zero exit so npm reports the failure instead of silently exiting
  process.exit(1);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports.get(sessionId)!.close();
      transports.delete(sessionId);
    } catch (error) {
      console.log(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  console.log("Server shutdown complete");
  process.exit(0);
});
