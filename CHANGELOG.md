# Changelog

## 0.1.0

First release.

* MCP server with 9 tools and a `design_app` prompt.
* Adaptive interview: 33 questions (25 always asked, 8 follow-ups) in four rounds; inferred/default/user answer tracking; "use defaults" support.
* Popup forms through MCP elicitation, with an automatic chat-questionnaire fallback.
* Deterministic capacity calculator with consistency warnings.
* 23 generated sections (12 HLD, 11 LLD) with Mermaid diagrams, content validation and automatic repair.
* LLM router: Claude API, Ollama, OpenAI-compatible, IDE sampling, or host authoring by the chat model.
* Export to Markdown, standalone `.mmd` diagrams, `requirements.json` and a browser viewer.
* Stale-section tracking, per-section regeneration with feedback, resumable projects.
* End-to-end smoke test (22 checks), generated question/section catalogs, Windows and Unix setup helpers.
