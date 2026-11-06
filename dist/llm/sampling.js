/** Uses the IDE's own model through MCP sampling (the IDE may ask the user to approve each request). */
export function samplingProvider(server) {
    return {
        id: 'sampling',
        label: "IDE's model (MCP sampling)",
        async complete({ system, prompt, maxTokens }) {
            const res = await server.server.createMessage({
                messages: [{ role: 'user', content: { type: 'text', text: prompt } }],
                systemPrompt: system,
                maxTokens,
            }, { timeout: 10 * 60 * 1000 });
            const content = res.content;
            const parts = Array.isArray(content) ? content : [content];
            return parts
                .filter((c) => c?.type === 'text')
                .map((c) => c.text)
                .join('');
        },
    };
}
