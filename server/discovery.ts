/**
 * Server Discovery Routes
 *
 * Express router for MCP server discovery endpoints.
 * Provides .well-known endpoints for client discovery.
 */

import { Router, Request, Response } from "express";
import {
  getServerIdentityDocument,
  getProtectedResourceMetadata,
} from "./metadata.js";

/**
 * Create an Express router with MCP discovery endpoints
 *
 * @param baseUrl - Optional explicit base URL (defaults to request host)
 * @returns Express Router with discovery routes
 */
export function createDiscoveryRouter(baseUrl?: string): Router {
  const router = Router();

  // MCP Server Identity Document (primary discovery endpoint)
  router.get("/.well-known/mcp.json", (req: Request, res: Response) => {
    const effectiveBaseUrl = baseUrl || `${req.protocol}://${req.get("host")}`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.json(getServerIdentityDocument(effectiveBaseUrl));
  });

  // Alternative path for MCP discovery (without .json extension)
  router.get("/.well-known/mcp", (req: Request, res: Response) => {
    const effectiveBaseUrl = baseUrl || `${req.protocol}://${req.get("host")}`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    res.json(getServerIdentityDocument(effectiveBaseUrl));
  });

  // MCP Protected Resource Metadata (for non-OAuth servers)
  // Note: OAuth servers should use auth/metadata.ts instead
  router.get(
    "/.well-known/mcp-protected-resource",
    (req: Request, res: Response) => {
      const effectiveBaseUrl =
        baseUrl || `${req.protocol}://${req.get("host")}`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");

      res.json(getProtectedResourceMetadata(effectiveBaseUrl));
    }
  );

  return router;
}
