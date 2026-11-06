import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type LlmMode = 'auto' | 'provider' | 'sampling' | 'host';
export type ProviderId = 'anthropic' | 'ollama' | 'openai-compatible';
export type QuestionMode = 'auto' | 'elicit' | 'chat';

export interface Config {
  llm: {
    mode: LlmMode;
    provider?: ProviderId;
    model?: string;
    baseUrl?: string;
    /** NAME of the environment variable holding the API key (the key itself is never stored) */
    apiKeyEnv?: string;
    maxTokens: number;
    ollamaNumCtx: number;
  };
  ui: { questionMode: QuestionMode; maxQuestionsPerBatch: number };
  generation: { sectionsPerCall: number; maxRetries: number };
  output: { dir: string };
}

export const DEFAULT_CONFIG: Config = {
  llm: { mode: 'auto', maxTokens: 6000, ollamaNumCtx: 16384 },
  ui: { questionMode: 'auto', maxQuestionsPerBatch: 7 },
  generation: { sectionsPerCall: 4, maxRetries: 2 },
  output: { dir: 'docs/architecture' },
};

export function homeDir(): string {
  return process.env.ARCHFORGE_HOME || path.join(os.homedir(), '.archforge');
}
export function configPath(): string {
  return path.join(homeDir(), 'config.json');
}

export function defaultModel(p: ProviderId): string | undefined {
  return p === 'anthropic' ? 'claude-sonnet-5-5' : undefined;
}
export function defaultApiKeyEnv(p: ProviderId): string | undefined {
  if (p === 'anthropic') return 'ANTHROPIC_API_KEY';
  if (p === 'openai-compatible') return 'OPENAI_API_KEY';
  return undefined;
}
export function defaultBaseUrl(p: ProviderId): string {
  if (p === 'anthropic') return 'https://api.anthropic.com';
  if (p === 'ollama') return 'http://localhost:11434';
  return 'https://api.openai.com/v1';
}

function readFileConfig(): Partial<Config> {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

export function loadConfig(): Config {
  const f = readFileConfig();
  const cfg: Config = {
    llm: { ...DEFAULT_CONFIG.llm, ...(f.llm ?? {}) },
    ui: { ...DEFAULT_CONFIG.ui, ...(f.ui ?? {}) },
    generation: { ...DEFAULT_CONFIG.generation, ...(f.generation ?? {}) },
    output: { ...DEFAULT_CONFIG.output, ...(f.output ?? {}) },
  };
  const e = process.env;
  if (e.ARCHFORGE_LLM_MODE) cfg.llm.mode = e.ARCHFORGE_LLM_MODE as LlmMode;
  if (e.ARCHFORGE_LLM_PROVIDER) cfg.llm.provider = e.ARCHFORGE_LLM_PROVIDER as ProviderId;
  if (e.ARCHFORGE_LLM_MODEL) cfg.llm.model = e.ARCHFORGE_LLM_MODEL;
  if (e.ARCHFORGE_LLM_BASE_URL) cfg.llm.baseUrl = e.ARCHFORGE_LLM_BASE_URL;
  if (e.ARCHFORGE_LLM_API_KEY_ENV) cfg.llm.apiKeyEnv = e.ARCHFORGE_LLM_API_KEY_ENV;
  if (e.ARCHFORGE_QUESTION_MODE) cfg.ui.questionMode = e.ARCHFORGE_QUESTION_MODE as QuestionMode;
  return cfg;
}

export function saveConfig(cfg: Config): void {
  fs.mkdirSync(homeDir(), { recursive: true });
  // Persist only what is in the file layer plus the given values (env overrides are not persisted).
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

/** Load only the file layer (no env overrides) so `set` does not bake env values into the file. */
export function loadFileConfig(): Config {
  const f = readFileConfig();
  return {
    llm: { ...DEFAULT_CONFIG.llm, ...(f.llm ?? {}) },
    ui: { ...DEFAULT_CONFIG.ui, ...(f.ui ?? {}) },
    generation: { ...DEFAULT_CONFIG.generation, ...(f.generation ?? {}) },
    output: { ...DEFAULT_CONFIG.output, ...(f.output ?? {}) },
  };
}
