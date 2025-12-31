# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing MCP (Model Context Protocol) reference servers. The root-level "Everything" server exercises all MCP protocol features as a test server for MCP client builders. Additional reference servers live under `src/` (filesystem, fetch, git, memory, sequentialthinking, time).

## Build & Run Commands

### Everything Server (root level)
```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript to dist/
npm run watch            # Watch mode for development

# Run with different transports
npm run start:stdio           # Default stdio transport
npm run start:sse             # SSE transport (deprecated)
npm run start:streamableHttp  # Streamable HTTP transport
```

### Formatting
```bash
npm run prettier:check   # Check formatting
npm run prettier:fix     # Fix formatting
```

### Sub-servers (e.g., src/filesystem)
```bash
cd src/<package>
npm ci
npm run build
npm test                 # Run tests with vitest (if present)
```

## Architecture

### Everything Server Structure
- `index.ts` - CLI entry point, selects transport based on argument
- `server/index.ts` - Server factory: creates McpServer, registers all features
- `tools/` - Tool implementations, each exports `registerXTool(server)`, aggregated in `tools/index.ts`
- `resources/` - Resource implementations with same pattern
- `prompts/` - Prompt implementations with same pattern
- `transports/` - Transport implementations (stdio.ts, sse.ts, streamableHttp.ts)

### Extension Pattern
To add new MCP primitives:
1. Create file in appropriate folder (tools/, resources/, prompts/)
2. Export a `registerXTool(server)` / `registerXResources(server)` / `registerXPrompt(server)` function
3. Call it from the folder's `index.ts` aggregator

### Multi-client Support
The server supports concurrent clients. Per-session state is demonstrated via resource subscriptions (`resources/subscriptions.ts`) and simulated logging (`server/logging.ts`).

## Code Style

- ES modules with `.js` extension in import paths
- Zod schemas for tool input validation
- camelCase for variables/functions, PascalCase for types/classes, UPPER_CASE for constants
- kebab-case for file names and registered tools/prompts/resources
- Use verbs for tool names (e.g., `get-annotated-message` not `annotated-message`)
- 2-space indentation, trailing commas in multi-line objects

## Testing

Use **vitest** for TypeScript servers (see `src/filesystem` for example). Python servers use pytest.
