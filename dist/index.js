#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configPath, loadConfig, loadFileConfig, saveConfig } from './config.js';
import { runServer } from './server.js';
const HELP = `archforge-mcp — design HLD + LLD from an app idea, inside any MCP-capable IDE

Usage
  archforge-mcp                 Start the MCP server on stdio (this is what your IDE runs)
  archforge-mcp print-config    Print ready-to-paste MCP config snippets for VS Code, Cursor, Claude Desktop/Code, Windsurf
  archforge-mcp config [flags]  Show or change settings (stored in ${configPath()})
      --mode auto|provider|sampling|host
      --provider anthropic|ollama|openai-compatible|none
      --model <name>   --base-url <url>   --api-key-env <ENV_VAR_NAME>
      --questions auto|elicit|chat
  archforge-mcp help

API keys are never stored by this tool: put them in the "env" section of the MCP server entry in your IDE.`;
function flag(args, name) {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
}
function printConfig() {
    const entry = path.resolve(fileURLToPath(import.meta.url));
    const base = { command: 'node', args: [entry] };
    console.log('# 1) Minimal — uses the IDE\'s own model (no API key, nothing else to configure)');
    console.log('# VS Code: .vscode/mcp.json (or run "MCP: Add Server")');
    console.log(JSON.stringify({ servers: { archforge: { type: 'stdio', ...base } } }, null, 2));
    console.log('\n# Cursor (.cursor/mcp.json), Claude Desktop (claude_desktop_config.json), Windsurf and most others');
    console.log(JSON.stringify({ mcpServers: { archforge: base } }, null, 2));
    console.log('\n# Claude Code');
    console.log(`claude mcp add archforge -- node ${entry}`);
    console.log('\n# 2) Use the Claude API for writing the documents (VS Code asks for the key once and keeps it out of the file)');
    console.log(JSON.stringify({
        inputs: [{ type: 'promptString', id: 'anthropic-key', description: 'Anthropic API key', password: true }],
        servers: {
            archforge: {
                type: 'stdio',
                ...base,
                env: { ARCHFORGE_LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '${input:anthropic-key}' },
            },
        },
    }, null, 2));
    console.log('# Other IDEs: add  "env": { "ARCHFORGE_LLM_PROVIDER": "anthropic", "ANTHROPIC_API_KEY": "<your key>" }  to the server entry.');
    console.log('\n# 3) Use a local model through Ollama (free, offline)');
    console.log(JSON.stringify({ servers: { archforge: { type: 'stdio', ...base, env: { ARCHFORGE_LLM_PROVIDER: 'ollama', ARCHFORGE_LLM_MODEL: '<a model you have pulled, e.g. qwen2.5:14b>' } } } }, null, 2));
    console.log('\n# Once published to npm, replace command/args with:  "command": "npx", "args": ["-y", "archforge-mcp"]');
}
async function main() {
    const [cmd, ...rest] = process.argv.slice(2);
    switch (cmd) {
        case undefined:
        case 'serve':
            await runServer();
            return;
        case 'print-config':
            printConfig();
            return;
        case 'config': {
            const f = loadFileConfig();
            const mode = flag(rest, 'mode');
            const provider = flag(rest, 'provider');
            const model = flag(rest, 'model');
            const baseUrl = flag(rest, 'base-url');
            const keyEnv = flag(rest, 'api-key-env');
            const questions = flag(rest, 'questions');
            let changed = false;
            if (mode)
                ((f.llm.mode = mode), (changed = true));
            if (provider)
                ((f.llm.provider = provider === 'none' ? undefined : provider), (changed = true));
            if (model)
                ((f.llm.model = model), (changed = true));
            if (baseUrl)
                ((f.llm.baseUrl = baseUrl), (changed = true));
            if (keyEnv)
                ((f.llm.apiKeyEnv = keyEnv), (changed = true));
            if (questions)
                ((f.ui.questionMode = questions), (changed = true));
            if (changed)
                saveConfig(f);
            console.log(JSON.stringify(changed ? f : loadConfig(), null, 2));
            console.log(`\n(config file: ${configPath()})`);
            return;
        }
        case 'help':
        case '--help':
        case '-h':
            console.log(HELP);
            return;
        default:
            console.error(`Unknown command "${cmd}".\n\n${HELP}`);
            process.exitCode = 1;
    }
}
main().catch((e) => {
    console.error('[archforge] fatal:', e);
    process.exit(1);
});
