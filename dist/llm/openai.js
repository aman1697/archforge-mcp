import { postJson } from './http.js';
import { LlmError } from './types.js';
/** Works with OpenAI and any OpenAI-compatible server (LM Studio, vLLM, llama.cpp, OpenRouter, Azure-compatible gateways…). */
export function openaiProvider(opts) {
    const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const headers = opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {};
    return {
        id: `openai-compatible:${opts.model}`,
        label: `OpenAI-compatible (${opts.model})`,
        async complete({ system, prompt, maxTokens }) {
            const messages = [
                { role: 'system', content: system },
                { role: 'user', content: prompt },
            ];
            let data;
            try {
                data = await postJson(url, headers, { model: opts.model, messages, max_tokens: maxTokens }, 600_000);
            }
            catch (e) {
                // Newer OpenAI models reject max_tokens in favour of max_completion_tokens.
                if (e instanceof LlmError && e.status === 400 && /max_completion_tokens/.test(e.message)) {
                    data = await postJson(url, headers, { model: opts.model, messages, max_completion_tokens: maxTokens }, 600_000);
                }
                else
                    throw e;
            }
            const text = data?.choices?.[0]?.message?.content;
            if (!text)
                throw new LlmError('The model returned no content.');
            return text;
        },
    };
}
