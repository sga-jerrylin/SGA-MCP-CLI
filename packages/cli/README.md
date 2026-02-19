# mcp-claw

AI-powered MCP server generator. Turn any API (folder, URL, OpenAPI spec) into a working MCP server.

## Install

```bash
npm install -g mcp-claw
```

## Usage

```bash
# Generate from local folder
mcp-claw generate ./my-api-docs/

# Generate from URL
mcp-claw generate https://petstore.swagger.io/v2/swagger.json

# Configure API key
mcp-claw config set --key "your-openrouter-api-key"
mcp-claw config set --parser anthropic/claude-sonnet-4.5

# View history
mcp-claw memory show
```

## Pipeline

Explorer -> Architect -> Builder -> Tester -> (Publish)

- **Explorer**: reads files, crawls URLs (Playwright), extracts PDFs
- **Architect**: LLM semantic analysis -> MCP tool IR
- **Builder**: generates fastmcp-compatible server code
- **Tester**: validates generated server

## Requirements

- Node.js >= 18
- OpenRouter API key (https://openrouter.ai)
