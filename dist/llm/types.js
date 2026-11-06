export class LlmError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'LlmError';
    }
}
