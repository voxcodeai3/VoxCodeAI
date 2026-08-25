# AI Providers

`aiService.js` is the application-level interface. The rest of the
application calls `generateResponse()` and never talks to an AI vendor
directly.

The active provider is determined by the `AI_PROVIDER` environment
variable in `backend/.env`.

## Supported Providers

| `AI_PROVIDER` value | API format       | Notes                                              |
|---------------------|------------------|----------------------------------------------------|
| `gemini`            | Google GenAI     | Direct REST — no SDK required.                     |
| `openai`            | OpenAI           | Standard `/chat/completions`.                       |
| `openrouter`        | OpenAI-compat    | OpenRouter with optional `HTTP-Referer` header.     |
| `compatible`        | OpenAI-compat    | Any OpenAI-compatible endpoint (DeepSeek, Groq…).  |

If `AI_PROVIDER` is blank, `aiService.js` falls back to checking
whether `AI_API_KEY` is set (treated as `compatible`).

## Required Environment Variables

| Variable      | Required | Description                                              |
|---------------|----------|----------------------------------------------------------|
| `AI_PROVIDER` | Yes      | One of: `gemini`, `openai`, `openrouter`, `compatible`   |
| `AI_API_KEY`  | Yes      | API key for the selected provider                        |
| `AI_MODEL`    | No       | Model override (provider-specific default if omitted)    |
| `AI_BASE_URL` | No*      | *Required when `AI_PROVIDER=compatible`                  |

## Adding a New Provider

1. Add detection logic in `activeProvider()` inside `aiService.js`.
2. Implement a `call*()` function that returns the raw model output.
3. Wire it into the `if/else` chain inside `generateResponse()`.
4. Document the provider here.
