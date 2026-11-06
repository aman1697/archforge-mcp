import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const DEFAULT_CONFIG = {
    llm: { mode: 'auto', maxTokens: 6000, ollamaNumCtx: 16384 },
    ui: { questionMode: 'auto', maxQuestionsPerBatch: 7 },
    generation: { sectionsPerCall: 4, maxRetries: 2 },
    output: { dir: 'docs/architecture' },
};
export function homeDir() {
    return process.env.ARCHFORGE_HOME || path.join(os.homedir(), '.archforge');
}
export function configPath() {
    return path.join(homeDir(), 'config.json');
}
export function defaultModel(p) {
    return p === 'anthropic' ? 'claude-sonnet-5-5' : undefined;
}
export function defaultApiKeyEnv(p) {
    if (p === 'anthropic')
        return 'ANTHROPIC_API_KEY';
    if (p === 'openai-compatible')
        return 'OPENAI_API_KEY';
    return undefined;
}
export function defaultBaseUrl(p) {
    if (p === 'anthropic')
        return 'https://api.anthropic.com';
    if (p === 'ollama')
        return 'http://localhost:11434';
    return 'https://api.openai.com/v1';
}
function readFileConfig() {
    try {
        return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    }
    catch {
        return {};
    }
}
export function loadConfig() {
    const f = readFileConfig();
    const cfg = {
        llm: { ...DEFAULT_CONFIG.llm, ...(f.llm ?? {}) },
        ui: { ...DEFAULT_CONFIG.ui, ...(f.ui ?? {}) },
        generation: { ...DEFAULT_CONFIG.generation, ...(f.generation ?? {}) },
        output: { ...DEFAULT_CONFIG.output, ...(f.output ?? {}) },
    };
    const e = process.env;
    if (e.ARCHFORGE_LLM_MODE)
        cfg.llm.mode = e.ARCHFORGE_LLM_MODE;
    if (e.ARCHFORGE_LLM_PROVIDER)
        cfg.llm.provider = e.ARCHFORGE_LLM_PROVIDER;
    if (e.ARCHFORGE_LLM_MODEL)
        cfg.llm.model = e.ARCHFORGE_LLM_MODEL;
    if (e.ARCHFORGE_LLM_BASE_URL)
        cfg.llm.baseUrl = e.ARCHFORGE_LLM_BASE_URL;
    if (e.ARCHFORGE_LLM_API_KEY_ENV)
        cfg.llm.apiKeyEnv = e.ARCHFORGE_LLM_API_KEY_ENV;
    if (e.ARCHFORGE_QUESTION_MODE)
        cfg.ui.questionMode = e.ARCHFORGE_QUESTION_MODE;
    return cfg;
}
export function saveConfig(cfg) {
    fs.mkdirSync(homeDir(), { recursive: true });
    // Persist only what is in the file layer plus the given values (env overrides are not persisted).
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}
/** Load only the file layer (no env overrides) so `set` does not bake env values into the file. */
export function loadFileConfig() {
    const f = readFileConfig();
    return {
        llm: { ...DEFAULT_CONFIG.llm, ...(f.llm ?? {}) },
        ui: { ...DEFAULT_CONFIG.ui, ...(f.ui ?? {}) },
        generation: { ...DEFAULT_CONFIG.generation, ...(f.generation ?? {}) },
        output: { ...DEFAULT_CONFIG.output, ...(f.output ?? {}) },
    };
}
