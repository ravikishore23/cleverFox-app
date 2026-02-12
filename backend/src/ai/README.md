# AI module (backend)

This folder is designed to let you plug in different LLM providers and build agents/tools.

Suggested layout:

- `providers/` provider adapters (OpenAI/Anthropic/etc)
- `agents/` system prompts + orchestration
- `tools/` server-side tools (web search, files, DB, etc)
- `types/` shared request/response types

Env:

- `AI_PROVIDER=mock|openai`
- `OPENAI_API_KEY=...`
