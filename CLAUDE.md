# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing MCP (Model Context Protocol) reference servers:

- **Root level**: The "Everything" server - a comprehensive reference implementation exercising all MCP protocol features for testing MCP clients
- **`src/` subdirectories**: Individual focused MCP servers (filesystem, fetch, git, memory, sequentialthinking, time) - each is an independent npm package

**Architecture Documentation**: See [`docs/`](docs/) for detailed architecture documentation:

- [architecture.md](docs/architecture.md) - High-level design and multi-client support
- [structure.md](docs/structure.md) - Detailed project file organization
- [extension.md](docs/extension.md) - How to extend the server
- [features.md](docs/features.md) - Complete list of registered MCP primitives

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

Each sub-server is independent with its own package.json:

```bash
cd src/<package>
npm ci                   # Install dependencies (use ci for clean install)
npm run build            # Compile TypeScript to dist/
npm run watch            # Watch mode (if available)
npm test                 # Run tests with vitest (if tests present)
```

## Architecture

### Everything Server Structure

- [`index.ts`](index.ts) - CLI entry point, selects transport based on argument (stdio/sse/streamableHttp)
- [`server/index.ts`](server/index.ts) - Server factory: creates McpServer, registers all features, handles cleanup
- [`tools/`](tools/) - Tool implementations, each exports `registerXTool(server)`, aggregated in [`tools/index.ts`](tools/index.ts)
- [`resources/`](resources/) - Resource implementations with same pattern, aggregated in [`resources/index.ts`](resources/index.ts)
- [`prompts/`](prompts/) - Prompt implementations with same pattern, aggregated in [`prompts/index.ts`](prompts/index.ts)
- [`transports/`](transports/) - Transport implementations ([stdio.ts](transports/stdio.ts), [sse.ts](transports/sse.ts), [streamableHttp.ts](transports/streamableHttp.ts))
- [`auth/`](auth/) - OAuth 2.1 authentication modules for HTTP transports

### Extension Pattern

To add new MCP primitives (tools/resources/prompts):

1. Create a new file in the appropriate folder (e.g., `tools/my-new-tool.ts`)
2. Export a `registerXTool(server)` / `registerXResources(server)` / `registerXPrompt(server)` function
3. Import and call it from the folder's `index.ts` aggregator (e.g., add to `tools/index.ts`)
4. Use Zod schemas for input validation with descriptive field documentation
5. Follow existing patterns for error handling and response formatting

### Multi-client Support

The server supports concurrent clients. Per-session state is demonstrated via resource subscriptions (`resources/subscriptions.ts`) and simulated logging (`server/logging.ts`).

### OAuth Authentication

The HTTP transports (SSE and Streamable HTTP) support OAuth 2.1 authentication with Microsoft Entra ID.

**Module Structure** (`auth/`):

- `config.ts` - Environment configuration loader
- `metadata.ts` - RFC 9728 Protected Resource Metadata endpoints
- `jwt-middleware.ts` - JWT validation using JWKS
- `scope-middleware.ts` - Scope/role validation
- `security-headers.ts` - Security response headers
- `error-handlers.ts` - OAuth error handling
- `rate-limiter.ts` - Rate limiting middleware
- `index.ts` - Aggregated exports

**Configuration**: Copy `.env.example` to `.env` and configure:

- `ENTRA_CLIENT_ID` - Your Entra ID Application ID
- `ENTRA_TENANT_ID` - Your tenant ID (or use AUTHORIZED_TENANTS=common)
- `OAUTH_ENABLED` - Set to 'false' to disable OAuth for development

## Code Style

### Naming Conventions

- **camelCase**: variables, functions (e.g., `registerTool`, `maxTokens`)
- **PascalCase**: types, classes, Zod schemas (e.g., `McpServer`, `EchoSchema`)
- **UPPER_CASE**: constants (e.g., `MAX_FILE_SIZE`)
- **kebab-case**: file names and registered MCP primitives (e.g., `get-annotated-message.ts`, tool name: `get-annotated-message`)
- Use verbs for tool names (e.g., `get-annotated-message` not `annotated-message`)

### TypeScript & Modules

- ES modules with `.js` extension in import paths (required for Node.js ESM)
- Place all imports at top of file, grouped: external dependencies first, then internal modules
- Strict typing - explicitly type all functions and variables
- Prefer async/await over callbacks and Promise chains

### Code Formatting

- 2-space indentation
- Trailing commas in multi-line objects/arrays
- Zod schemas for tool input validation with descriptive field documentation
- Include helpful descriptions and examples in schemas

### Error Handling

- Use try/catch blocks with clear error messages
- Implement proper cleanup for timers and resources in server shutdown
- Return structured error responses in tool callbacks with `isError: true`

## Testing

- **TypeScript servers**: Use vitest (see [`src/filesystem`](src/filesystem) for test examples)
- **Python servers**: Use pytest (if applicable)
- Test files live in `__tests__/` directories within each package
- Run tests: `npm test` (runs `vitest run --coverage`)
- Configuration: See `vitest.config.ts` in sub-packages for setup

## Important Files

- [`AGENTS.md`](AGENTS.md) - Additional development guidelines and patterns
- [`.env.example`](.env.example) - OAuth configuration template for HTTP transports
- [`package.json`](package.json) - Root package with build scripts and dependencies
- [`tsconfig.json`](tsconfig.json) - TypeScript configuration
- [`docs/`](docs/) - Comprehensive architecture and implementation documentation
