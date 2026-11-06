import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defaultApiKeyEnv, defaultBaseUrl, defaultModel, type Config } from '../config.js';
import { anthropicProvider } from './anthropic.js';
import { ollamaProvider } from './ollama.js';
import { openaiProvider } from './openai.js';
import { samplingProvider } from './sampling.js';
import type { LlmProvider } from './types.js';

export type Resolved =
  | { kind: 'provider'; provider: LlmProvider; note?: string }
  | { kind: 'sampling'; provider: LlmProvider; note?: string }
  | { kind: 'host'; note?: string };

export function clientSupportsSampling(server: McpServer): boolean {
  return !!server.server.getClientCapabilities()?.sampling;
}

export function clientSupportsElicitation(server: McpServer): boolean {
  const e = server.server.getClientCapabilities()?.elicitation as Record<string, unknown> | undefined;
  return !!e && (e.form !== undefined || e.url === undefined);
}

/** Build the configured provider, or explain why it cannot be used. */
export function buildProvider(cfg: Config): { provider?: LlmProvider; problem?: string } {
  const p = cfg.llm.provider;
  if (!p) return { problem: 'no provider configured' };
  const model = cfg.llm.model ?? defaultModel(p);
  if (!model) return { problem: `provider "${p}" needs a model (set llm.model)` };
  const baseUrl = cfg.llm.baseUrl ?? defaultBaseUrl(p);
  const keyEnv = cfg.llm.apiKeyEnv ?? defaultApiKeyEnv(p);
  const apiKey = keyEnv ? process.env[keyEnv] : undefined;
  if (p === 'anthropic') {
    if (!apiKey) return { problem: `environment variable ${keyEnv} is not set (add it to the "env" of this server in your IDE's MCP config)` };
    return { provider: anthropicProvider({ apiKey, model, baseUrl }) };
  }
  if (p === 'ollama') return { provider: ollamaProvider({ model, baseUrl, numCtx: cfg.llm.ollamaNumCtx }) };
  // openai-compatible: key optional (local servers often need none)
  return { provider: openaiProvider({ apiKey, model, baseUrl }) };
}

/**
 * Decide who writes the design text.
 *   auto     → configured provider → IDE sampling → host authoring
 *   provider → configured provider (falls back with a note)
 *   sampling → IDE sampling (falls back with a note)
 *   host     → the IDE chat model writes sections and submits them
 */
export function resolveLlm(cfg: Config, server: McpServer): Resolved {
  const mode = cfg.llm.mode;
  const sampling = clientSupportsSampling(server);
  const built = buildProvider(cfg);

  if (mode === 'host') return { kind: 'host' };

  if (mode === 'sampling') {
    if (sampling) return { kind: 'sampling', provider: samplingProvider(server) };
    return { kind: 'host', note: 'llm.mode is "sampling" but this IDE does not support MCP sampling — using the IDE chat model instead.' };
  }

  if (mode === 'provider') {
    if (built.provider) return { kind: 'provider', provider: built.provider };
    return { kind: 'host', note: `llm.mode is "provider" but ${built.problem} — using the IDE chat model instead.` };
  }

  // auto
  if (built.provider) return { kind: 'provider', provider: built.provider };
  const why = cfg.llm.provider ? ` (configured provider unusable: ${built.problem})` : '';
  if (sampling) return { kind: 'sampling', provider: samplingProvider(server), note: why ? `Using the IDE model via sampling${why}.` : undefined };
  return { kind: 'host', note: why ? `Using the IDE chat model${why}.` : undefined };
}
