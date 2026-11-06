export interface LlmRequest {
  system: string;
  prompt: string;
  maxTokens: number;
}

export interface LlmProvider {
  /** e.g. "anthropic:claude-sonnet-5-5", "ollama:llama3.1", "sampling" */
  id: string;
  label: string;
  complete(req: LlmRequest): Promise<string>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
