FROM node:22.12-alpine AS builder

COPY . /app
WORKDIR /app

RUN --mount=type=cache,target=/root/.npm npm install && npm run build

FROM node:22-alpine AS release

# OCI Image Annotations
# https://github.com/opencontainers/image-spec/blob/main/annotations.md
LABEL org.opencontainers.image.title="MCP Everything Server"
LABEL org.opencontainers.image.description="MCP server that exercises all features of the MCP protocol"
LABEL org.opencontainers.image.url="https://github.com/getexcited/reference-mcp-server"
LABEL org.opencontainers.image.source="https://github.com/getexcited/reference-mcp-server"
LABEL org.opencontainers.image.vendor="Model Context Protocol"
LABEL org.opencontainers.image.licenses="MIT"
# MCP-specific annotation for registry discovery
LABEL io.modelcontextprotocol.server.name="io.github.getexcited/reference-mcp-server"

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV NODE_ENV=production

RUN npm ci --ignore-scripts --omit-dev

# Default to streamableHttp transport; can be overridden with: stdio, sse, streamableHttp
CMD ["node", "dist/index.js", "streamableHttp"]