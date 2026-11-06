import { postJson } from './http.js';
import { LlmError, type LlmProvider } from './types.js';

export function anthropicProvider(opts: { apiKey: string; model: string; baseUrl: string }): LlmProvider {
  return {
    id: `anthropic:${opts.model}`,
    label: `Claude API (${opts.model})`,
    async complete({ system, prompt, maxTokens }) {
      const data = await postJson(
        `${opts.baseUrl.replace(/\/+$/, '')}/v1/messages`,
        { 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
        { model: opts.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] },
      );
      const text = (data?.content ?? [])
        .filter((b: any) => b?.type === 'text')
        .map((b: any) => b.text)
        .join('');
      if (!text) throw new LlmError('Claude API returned no text content.');
      return text;
    },
  };
}
