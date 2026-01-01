# Reference MCP Server

**[Architecture](docs/architecture.md)
| [Project Structure](docs/structure.md)
| [Startup Process](docs/startup.md)
| [Server Features](docs/features.md)
| [Extension Points](docs/extension.md)
| [How It Works](docs/how-it-works.md)**

This is a comprehensive reference implementation of the Model Context Protocol (MCP) designed to exercise all protocol features for testing and development. While not intended for production use, it serves as a valuable testing ground for MCP client developers and a demonstration of protocol capabilities.

**Key Features:**

- **Complete MCP Protocol Coverage**: Tools, resources, prompts, sampling, and resource subscriptions
- **Latest Spec Features**: Enhanced Sampling with tool calling and Server Discovery (November 2025 MCP spec)
- **Multiple Transports**: stdio, HTTP+SSE (deprecated), and Streamable HTTP
- **OAuth 2.1 Authentication**: Microsoft Entra ID integration with JWT validation for HTTP transports
- **Multi-Client Support**: Demonstrates per-session state management and concurrent client handling
- **Production-Ready Patterns**: Proper error handling, cleanup, structured logging, and security best practices

This fork extends the official MCP Everything server with enterprise authentication, modern protocol features, and comprehensive documentation to help developers understand real-world MCP server implementation.

## Quick Start with Docker

The easiest way to get started is using our pre-built Docker image:

```bash
docker pull ghcr.io/getexcited/reference-mcp-server:latest
```

Run with stdio transport (default):

```bash
docker run -i --rm ghcr.io/getexcited/reference-mcp-server:latest
```

Run with SSE transport:

```bash
docker run -i --rm ghcr.io/getexcited/reference-mcp-server:latest node dist/index.js sse
```

Run with Streamable HTTP transport:

```bash
docker run -i --rm ghcr.io/getexcited/reference-mcp-server:latest node dist/index.js streamableHttp
```

### Docker Image Details

- **Registry**: `ghcr.io/getexcited/reference-mcp-server`
- **Available tags**: `latest`, version tags (e.g., `1.0.0`), commit SHAs
- **Platforms**: `linux/amd64`, `linux/arm64`
- **Base**: Node.js 22 Alpine Linux

## Tools, Resources, Prompts, and Other Features

A complete list of the registered MCP primitives and other protocol features demonstrated can be found in the [Server Features](docs/features.md) document.

## Usage with Claude Desktop (uses [stdio Transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#stdio))

### Option 1: Using Docker (Recommended)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "everything": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "ghcr.io/getexcited/reference-mcp-server:latest"
      ]
    }
  }
}
```

### Option 2: Using NPX

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "everything": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
  }
}
```

## Usage with VS Code

For quick installation, use one of the one-click install buttons below...

[![Install with Docker in VS Code](https://img.shields.io/badge/VS_Code-Docker-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=everything&config=%7B%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22ghcr.io%2Fgetexcited%2Freference-mcp-server%3Alatest%22%5D%7D) [![Install with Docker in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Docker-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=everything&config=%7B%22command%22%3A%22docker%22%2C%22args%22%3A%5B%22run%22%2C%22-i%22%2C%22--rm%22%2C%22ghcr.io%2Fgetexcited%2Freference-mcp-server%3Alatest%22%5D%7D&quality=insiders)

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=everything&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40modelcontextprotocol%2Fserver-everything%22%5D%7D) [![Install with NPX in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-NPM-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=everything&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40modelcontextprotocol%2Fserver-everything%22%5D%7D&quality=insiders)

For manual installation, you can configure the MCP server using one of these methods:

**Method 1: User Configuration (Recommended)**
Add the configuration to your user-level MCP configuration file. Open the Command Palette (`Ctrl + Shift + P`) and run `MCP: Open User Configuration`. This will open your user `mcp.json` file where you can add the server configuration.

**Method 2: Workspace Configuration**
Alternatively, you can add the configuration to a file called `.vscode/mcp.json` in your workspace. This will allow you to share the configuration with others.

> For more details about MCP configuration in VS Code, see the [official VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

#### Docker (Recommended)

```json
{
  "servers": {
    "everything": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "ghcr.io/getexcited/reference-mcp-server:latest"
      ]
    }
  }
}
```

#### NPX

```json
{
  "servers": {
    "everything": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
  }
}
```

## OAuth 2.1 Authentication Configuration

This server supports OAuth 2.1 authentication with Microsoft Entra ID for HTTP transports (SSE and Streamable HTTP). OAuth is **disabled by default** and only required when using HTTP transports.

### Quick Setup

1. Copy the example environment file:

```shell
cp .env.example .env
```

2. Configure your Entra ID application settings in `.env`:

```bash
# Required for OAuth
ENTRA_TENANT_ID=your-tenant-id          # Your Entra ID tenant ID
ENTRA_CLIENT_ID=your-application-id     # Your Entra ID application/client ID
MCP_SERVER_URL=https://your-server.com  # Public URL of your MCP server

# Optional - disable OAuth for development/testing
OAUTH_ENABLED=false
```

### Environment Variables

| Variable                  | Required | Description                                                                  | Default                    |
| ------------------------- | -------- | ---------------------------------------------------------------------------- | -------------------------- |
| `OAUTH_ENABLED`           | No       | Enable/disable OAuth authentication                                          | `true`                     |
| `ENTRA_TENANT_ID`         | Yes\*    | Your Entra ID tenant ID (can be omitted if using `AUTHORIZED_TENANTS`)       | -                          |
| `ENTRA_CLIENT_ID`         | Yes\*    | Your Entra ID application/client ID                                          | -                          |
| `MCP_SERVER_URL`          | Yes\*    | Public URL of your MCP server                                                | `http://localhost:3001`    |
| `MCP_RESOURCE_IDENTIFIER` | No       | Resource identifier for token validation                                     | Same as `MCP_SERVER_URL`   |
| `AUTHORIZED_TENANTS`      | No       | Comma-separated tenant IDs allowed to access (use `common` for multi-tenant) | Empty (single-tenant mode) |
| `PORT`                    | No       | Server port for HTTP transports                                              | `3001`                     |
| `NODE_ENV`                | No       | Node environment (`development`, `production`)                               | `development`              |
| `ALLOWED_ORIGINS`         | No       | CORS allowed origins (comma-separated or `*`)                                | `*`                        |

\* Required only when `OAUTH_ENABLED=true`

### Setting Up Microsoft Entra ID

1. Register an application in [Microsoft Entra ID](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps)
2. Configure API permissions for your application
3. Note the Application (client) ID and Tenant ID
4. Configure the redirect URIs for your application
5. Create a client secret (if using confidential client flow)

For detailed OAuth setup instructions, see the [auth/ module documentation](auth/README.md).

### Disabling OAuth for Development

For local development with stdio transport or testing without authentication:

```bash
OAUTH_ENABLED=false npm run start:stdio
```

Or add `OAUTH_ENABLED=false` to your `.env` file.

## Development - Running from Source

### Install dependencies

```shell
npm install
```

### Build the project

```shell
npm run build
```

### Run with stdio transport (default)

```shell
npm run start:stdio
```

### Run with SSE transport (deprecated)

**Note:** Requires OAuth configuration (see above section)

```shell
npm run start:sse
```

### Run with Streamable HTTP transport

**Note:** Requires OAuth configuration (see above section)

```shell
npm run start:streamableHttp
```

### Watch mode for development

```shell
npm run watch
```

## Upstream NPM Package

This fork is based on the official MCP Everything server. To use the original upstream version:

```shell
npx @modelcontextprotocol/server-everything
```
