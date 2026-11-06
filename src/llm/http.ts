import { LlmError } from './types.js';

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 300_000,
): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    const reason = e?.name === 'TimeoutError' ? `timed out after ${Math.round(timeoutMs / 1000)}s` : (e?.cause?.code ?? e?.message ?? String(e));
    throw new LlmError(`Could not reach ${new URL(url).host}: ${reason}`);
  }
  const text = await res.text();
  if (!res.ok) throw new LlmError(`HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 500)}`, res.status);
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError(`Non-JSON response from ${new URL(url).host}: ${text.slice(0, 200)}`);
  }
}
