# AI Providers & Model Pool

VoxCode supports a pool of multiple AI models with automatic failover.
If one model is rate-limited, the system seamlessly switches to the next
available model. Rate-limited models sleep for 1 hour, then are
health-checked and reactivated.

## Architecture

```
aiService.js
      ↓
modelManager.js
      ↓
  ┌───┼───┐
  ↓       ↓
Model A  Model B  …
```

## Model Configuration

Models are configured via numbered env vars in `backend/.env`:

```env
AI_MODEL_1_PROVIDER=gemini
AI_MODEL_1_NAME=gemini-2.0-flash
AI_MODEL_1_API_KEY=your_key_here
AI_MODEL_1_BASE_URL=
AI_MODEL_1_PRIORITY=1

AI_MODEL_2_PROVIDER=openai
AI_MODEL_2_NAME=gpt-4o-mini
AI_MODEL_2_API_KEY=your_key_here
AI_MODEL_2_BASE_URL=
AI_MODEL_2_PRIORITY=2
```

Up to 20 models are supported. Lower priority number = higher preference.

### Legacy fallback

When no numbered models are configured, the system falls back to the
single-model env vars (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`).

## Supported Providers

| `AI_MODEL_N_PROVIDER` | API format       | Notes                              |
|-----------------------|------------------|------------------------------------|
| `gemini`              | Google GenAI     | Direct REST — no SDK required.     |
| `openai`              | OpenAI           | Standard `/chat/completions`.       |
| `openrouter`          | OpenAI-compat    | OpenRouter with referer header.     |
| `compatible`          | OpenAI-compat    | Any OpenAI-compatible endpoint.     |
| *(blank)*             | OpenAI-compat    | Treated as compatible.              |

## Model States

| State          | Meaning                                      |
|----------------|----------------------------------------------|
| `AVAILABLE`    | Ready to process requests.                   |
| `IN_USE`       | Currently processing a request.              |
| `SLEEPING`     | Rate-limited — sleeping for 1 hour.          |
| `UNAVAILABLE`  | Auth error or persistent failure.            |

## Failover Flow

1. Select highest-priority `AVAILABLE` model.
2. Send request.
3. If **success** → return response, release model.
4. If **rate-limited** → mark `SLEEPING` (1 hour), try next model.
5. If **retryable error** → mark error, try next model.
6. If **non-retryable** (auth) → mark `UNAVAILABLE`, try next model.
7. If **all models exhausted** → return `ALL_MODELS_UNAVAILABLE`.

Each model is attempted at most once per request (no infinite loops).

## Sleep & Recovery

- Rate-limited models sleep for exactly **1 hour**.
- Sleep state is persisted to `backend/model-state.json` (survives restarts).
- On wake, a lightweight health check verifies the model responds.
- If still rate-limited → sleep another hour.
- If available → returned to active pool.

## Monitoring

`GET /api/ai/models` returns model statuses (no API keys exposed):

```json
{
  "models": [
    { "id": "model-1", "provider": "gemini", "name": "gemini-2.0-flash", "priority": 1, "status": "AVAILABLE" },
    { "id": "model-2", "provider": "openai", "name": "gpt-4o-mini", "priority": 2, "status": "SLEEPING", "sleepUntil": "2026-08-25T16:00:00Z" }
  ]
}
```

## Adding a New Provider

1. Add env vars for the new model slot.
2. No code changes needed — `modelManager.js` auto-discovers numbered slots.
3. For a new provider format, add a `call*()` function in `aiService.js`.
