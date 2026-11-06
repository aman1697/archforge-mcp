# Examples

Ready-to-copy MCP configuration files. In every file, replace `C:\\path\\to\\archforge-mcp` with the real
location of this project (inside JSON strings, Windows backslashes must be doubled; macOS/Linux paths use `/`).

The easiest way to get the exact text for your machine is:

```
node dist/index.js print-config
```

| File | Use it for |
|---|---|
| `claude-code.mcp.json` | Claude Code → save as **`.mcp.json`** (leading dot) in your project folder |
| `vscode.mcp.json` | VS Code (Copilot Chat agent mode) → save as `.vscode/mcp.json` |
| `cursor-windsurf-claude-desktop.mcp.json` | Cursor, Windsurf, Claude Desktop and most other MCP clients |
| `with-claude-api.mcp.json` | Have the Claude API write the documents |
| `with-ollama.mcp.json` | Have a local Ollama model write the documents |
| `with-openai-compatible.mcp.json` | OpenAI, OpenRouter, LM Studio, vLLM … |

The `with-*` files show only the `env` block you add; merge it into whichever client format you use.
Never paste a real API key into a file you commit — keep it in an environment variable.
