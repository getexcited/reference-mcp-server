import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "../server/index.js";
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

console.error("Starting SSE server...");

// Express app with permissive CORS for testing with Inspector direct connect mode
const app = express();

// Security headers for all responses
app.use(securityHeaders);

app.use(
  cors({
    origin: oauthConfig.allowedOrigins.includes("*")
      ? "*"
      : oauthConfig.allowedOrigins,
    methods: "GET,POST",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    exposedHeaders: ["WWW-Authenticate"],
  })
);

// Rate limiting for metadata endpoints
app.use("/.well-known", metadataLimiter);

// OAuth metadata endpoints (RFC 9728)
app.use(createMetadataRouter());

// MCP discovery endpoints (server identity document)
app.use(createDiscoveryRouter());

// Map sessionId to transport for each client
const transports: Map<string, SSEServerTransport> = new Map<
  string,
  SSEServerTransport
>();

/**
 * Middleware stack for protected MCP endpoints.
 * When OAuth is disabled, endpoints are unprotected (for development).
 */
const protectedMiddleware = oauthConfig.oauthEnabled
  ? [apiLimiter, bearerAuth, requireScope(MCP_TOOL_SCOPES)]
  : [apiLimiter];

// Handle GET requests for new SSE streams
app.get("/sse", ...protectedMiddleware, async (req, res) => {
  let transport: SSEServerTransport;
  const { server, cleanup } = createServer();

  // Session Id should not exist for GET /sse requests
  if (req?.query?.sessionId) {
    const sessionId = req?.query?.sessionId as string;
    transport = transports.get(sessionId) as SSEServerTransport;
    console.error(
      "Client Reconnecting? This shouldn't happen; when client has a sessionId, GET /sse should not be called again.",
      transport.sessionId
    );
  } else {
    // Create and store transport for the new session
    transport = new SSEServerTransport("/message", res);
    transports.set(transport.sessionId, transport);

    // Connect server to transport
    await server.connect(transport);
    const sessionId = transport.sessionId;
    console.error("Client Connected: ", sessionId);

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

    // Handle close of connection
    server.server.onclose = async () => {
      const sessionId = transport.sessionId;
      console.error("Client Disconnected: ", sessionId);
      transports.delete(sessionId);
      cleanup(sessionId);
    };
  }
});

// Handle POST requests for client messages
app.post("/message", ...protectedMiddleware, async (req, res) => {
  // Session Id should exist for POST /message requests
  const sessionId = req?.query?.sessionId as string;

  // Get the transport for this session and use it to handle the request
  const transport = transports.get(sessionId);
  if (transport) {
    console.error("Client Message from", sessionId);
    await transport.handlePostMessage(req, res);
  } else {
    console.error(`No transport found for sessionId ${sessionId}`);
    res.status(400).json({
      error: "invalid_session",
      error_description: "No valid session found for the provided session ID",
    });
  }
});

// Error handlers
app.use(handleAuthError);
app.use(handleGeneralError);

// Start the express server
const PORT = oauthConfig.port;
app.listen(PORT, () => {
  console.error(`Server is running on port ${PORT}`);
  console.error(`OAuth enabled: ${oauthConfig.oauthEnabled}`);
  if (oauthConfig.oauthEnabled) {
    console.error(
      `Protected Resource Metadata: ${oauthConfig.mcpServerUrl}/.well-known/oauth-protected-resource`
    );
  }
});
