# Configuration reference

Archforge works with **no configuration**: the IDE's chat model writes the documents and questions appear as popup forms or chat questions, whichever your IDE supports. Configure only if you want a different model to write the documents, or want to tune behavior.

## 1. Where settings come from

Later layers win:

1. Built-in defaults
2. `~/.archforge/config.json` (Windows: `C:\Users\<you>\.archforge\config.json`)
3. `ARCHFORGE_*` environment variables (usually set in the `env` block of the server entry in your IDE's MCP config)

Ways to change them:

* In chat: *"Run archforge_config with llmMode host"* (writes to `config.json`)
* In a terminal: `node dist/index.js config --mode provider --provider ollama --model qwen2.5:14b`
* By editing `config.json` directly
* By setting environment variables in the MCP config (recommended for provider settings, because they travel with the IDE config)

`node dist/index.js config` with no flags prints the effective settings. `archforge_config` in chat shows diagnostics: what your IDE supports, which model will write the documents, and whether the provider is reachable; add `test:true` to send a tiny test request.

## 2. Settings

| `config.json` key | Environment variable | Default | Meaning |
|---|---|---|---|
| `llm.mode` | `ARCHFORGE_LLM_MODE` | `auto` | `auto`: provider → IDE sampling → chat model. `provider`: configured provider (falls back with a note). `sampling`: IDE model via MCP sampling (falls back). `host`: the chat model always writes |
| `llm.provider` | `ARCHFORGE_LLM_PROVIDER` | none | `anthropic`, `ollama` or `openai-compatible` |
| `llm.model` | `ARCHFORGE_LLM_MODEL` | `claude-sonnet-5-5` for `anthropic`; **required** for the others | Model name as the provider knows it |
| `llm.baseUrl` | `ARCHFORGE_LLM_BASE_URL` | `https://api.anthropic.com`, `http://localhost:11434`, `https://api.openai.com/v1` respectively | API address |
| `llm.apiKeyEnv` | `ARCHFORGE_LLM_API_KEY_ENV` | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | **Name** of the environment variable that holds the key |
| `llm.maxTokens` | — | `6000` | Maximum output tokens per section (config file only) |
| `llm.ollamaNumCtx` | — | `16384` | Context window requested from Ollama (config file only) |
| `ui.questionMode` | `ARCHFORGE_QUESTION_MODE` | `auto` | `auto`: popup forms when supported; `elicit`: force forms; `chat`: always chat questions |
| `ui.maxQuestionsPerBatch` | — | `7` | Questions per form / chat batch (config file only) |
| `generation.sectionsPerCall` | — | `4` (host mode uses at most 3) | Sections written per tool call; lower it if your client times out |
| `generation.maxRetries` | — | `2` | Automatic repair attempts per section in provider/sampling mode |
| `output.dir` | — | `docs/architecture` | Export folder, relative to the workspace root |
| — | `ARCHFORGE_HOME` | `~/.archforge` | Where config, projects and fallback exports live |

Example `config.json`:

```json
{
  "llm": { "mode": "auto", "provider": "ollama", "model": "qwen2.5:14b", "maxTokens": 6000, "ollamaNumCtx": 16384 },
  "ui": { "questionMode": "auto", "maxQuestionsPerBatch": 7 },
  "generation": { "sectionsPerCall": 4, "maxRetries": 2 },
  "output": { "dir": "docs/architecture" }
}
```

## 3. API keys

Archforge **never stores keys**. It reads the variable named by `llm.apiKeyEnv` from the environment of the server process. Two common ways to provide it:

**A. A user-level environment variable** (keeps the key out of every file)

* Windows (PowerShell): `setx ANTHROPIC_API_KEY "sk-ant-..."` — then **fully quit and reopen the IDE** (a window reload is not enough, because applications read the environment at launch).
* macOS / Linux: add `export ANTHROPIC_API_KEY="sk-ant-..."` to your shell profile and restart the IDE from a new terminal session.

Then reference it in the MCP config: `"ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"` (Claude Code expands `${VAR}` in `.mcp.json`).

**B. A prompt in the IDE** — VS Code can ask for the key once and keep it out of the file:

```json
{
  "inputs": [{ "type": "promptString", "id": "anthropic-key", "description": "Anthropic API key", "password": true }],
  "servers": {
    "archforge": {
      "type": "stdio",
      "command": "node",
      "args": ["C:\\path\\to\\archforge-mcp\\dist\\index.js"],
      "env": { "ARCHFORGE_LLM_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "${input:anthropic-key}" }
    }
  }
}
```

Do not commit a real key to a repository.

## 4. Provider recipes

Add the `env` block inside the `archforge` server entry of your MCP config, reload the IDE window, then run `archforge_config` with `test:true`. Ready-made files are in [`../examples`](../examples).

### Claude API

```json
"env": {
  "ARCHFORGE_LLM_PROVIDER": "anthropic",
  "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
}
```

Optional: `"ARCHFORGE_LLM_MODEL": "<another model name>"`. A full design makes about 22 model calls (more if diagrams need repair), so expect a modest per-design cost on a paid API.

### Ollama (local, offline)

1. Install Ollama and keep it running.
2. `ollama pull qwen2.5:14b` (or another capable model).

```json
"env": {
  "ARCHFORGE_LLM_PROVIDER": "ollama",
  "ARCHFORGE_LLM_MODEL": "qwen2.5:14b"
}
```

Notes: use a model of roughly 14B parameters or more; smaller models give thinner sections and more diagram errors. Generation is slower than a hosted API. Archforge asks Ollama for a 16k context window. If your machine is short on memory, lower `llm.ollamaNumCtx` and `llm.maxTokens` in `config.json`. For a remote Ollama, set `ARCHFORGE_LLM_BASE_URL`.

### OpenAI and OpenAI-compatible services

Works with any server that implements `POST {baseUrl}/chat/completions`: OpenAI, OpenRouter, Groq, LM Studio, vLLM, llama.cpp server, and gateways.

```json
"env": {
  "ARCHFORGE_LLM_PROVIDER": "openai-compatible",
  "ARCHFORGE_LLM_BASE_URL": "https://api.openai.com/v1",
  "ARCHFORGE_LLM_MODEL": "<model name>",
  "OPENAI_API_KEY": "${OPENAI_API_KEY}"
}
```

* **LM Studio**: `"ARCHFORGE_LLM_BASE_URL": "http://localhost:1234/v1"`; no key needed.
* **A different key variable**: set `ARCHFORGE_LLM_API_KEY_ENV` to its name.
* Check your provider's documentation for the exact base URL and model identifiers. Services whose URL or auth scheme is not OpenAI-style (for example Azure OpenAI deployments) are not supported directly; use an OpenAI-compatible gateway in front of them.

### Back to the IDE's own model

Remove the provider variables, or set the mode explicitly:

```
Run archforge_config with llmMode: host
```

`host` means the chat model writes each section; `sampling` means the server asks the IDE for completions (only if the IDE supports it); `auto` picks the best available.

## 5. Choosing a mode

| You want… | Use |
|---|---|
| Zero setup, no key | leave everything default (`auto`) |
| The highest quality and a fully hands-off run | `provider` with a strong hosted model |
| Privacy / offline | `provider` with Ollama |
| Always let the chat model write (and review as it goes) | `host` |
| To keep using the IDE's model without chat round trips | `sampling` (if supported) |

## 6. Per-IDE configuration files

| IDE / agent | File | Top-level key |
|---|---|---|
| Claude Code | `.mcp.json` in the project folder (or `claude mcp add`) | `mcpServers` |
| VS Code (Copilot Chat) | `.vscode/mcp.json` or *MCP: Open User Configuration* | `servers`, entries need `"type": "stdio"` |
| Cursor | `.cursor/mcp.json` or `~/.cursor/mcp.json` | `mcpServers` |
| Claude Desktop | `claude_desktop_config.json` (Settings → Developer → Edit Config) | `mcpServers` |
| Windsurf and others | the tool's MCP settings | normally `mcpServers` |

Always use an **absolute path** to `dist/index.js`, and double the backslashes in JSON on Windows. `node dist/index.js print-config` prints correct snippets for your machine. Check your IDE's documentation if its MCP file location or format differs from the table.

## 7. Resetting

* Forget one project: delete `~/.archforge/projects/<id>.json`.
* Reset settings: delete `~/.archforge/config.json`.
* Remove everything: delete the `~/.archforge` folder.
