import { postJson } from './http.js';
import { LlmError } from './types.js';
export function ollamaProvider(opts) {
    return {
        id: `ollama:${opts.model}`,
        label: `Ollama (${opts.model})`,
        async complete({ system, prompt, maxTokens }) {
            const data = await postJson(`${opts.baseUrl.replace(/\/+$/, '')}/api/chat`, {}, {
                model: opts.model,
                stream: false,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt },
                ],
                // Ollama's default context window is small and silently truncates long prompts.
                options: { num_ctx: opts.numCtx, num_predict: maxTokens, temperature: 0.3 },
            }, 900_000);
            const text = data?.message?.content;
            if (!text)
                throw new LlmError('Ollama returned no content (is the model pulled? try `ollama pull ' + opts.model + '`).');
            return text;
        },
    };
}
