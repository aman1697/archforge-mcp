import { postJson } from './http.js';
import { LlmError, type LlmProvider } from './types.js';

/** Works with OpenAI and any OpenAI-compatible server (LM Studio, vLLM, llama.cpp, OpenRouter, Azure-compatible gateways…). */
export function openaiProvider(opts: { apiKey?: string; model: string; baseUrl: string }): LlmProvider {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {};
  return {
    id: `openai-compatible:${opts.model}`,
    label: `OpenAI-compatible (${opts.model})`,
    async complete({ system, prompt, maxTokens }) {
      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ];
      let data: any;
      try {
        data = await postJson(url, headers, { model: opts.model, messages, max_tokens: maxTokens }, 600_000);
      } catch (e: any) {
        // Newer OpenAI models reject max_tokens in favour of max_completion_tokens.
        if (e instanceof LlmError && e.status === 400 && /max_completion_tokens/.test(e.message)) {
          data = await postJson(url, headers, { model: opts.model, messages, max_completion_tokens: maxTokens }, 600_000);
        } else throw e;
      }
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new LlmError('The model returned no content.');
      return text;
    },
  };
}
