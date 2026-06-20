# GLP-1 Coach — AI Proxy (server-side)

This small backend holds the **OpenAI secret key** and forwards chat/vision
requests from the app to OpenAI. The key **never ships in the mobile bundle**
(report A1 — client-side keys are extractable from any installed app).

```
App (callAIChat)  ──POST {messages,...}──▶  /api/ai  ──Bearer key──▶  OpenAI
                  ◀── { choices:[{message}] } ──────────────────────┘
```

The app reads the proxy URL from `extra.aiProxyUrl` (or
`EXPO_PUBLIC_AI_PROXY_URL`) — see `src/services/aiClient.js`. When the URL is
unset or the request fails, the app falls back to its offline behavior (local
food-DB estimate / local coach reply) and never crashes or leaks a key.

## Endpoint

`POST /api/ai`

Request body (OpenAI-compatible subset):

```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "max_tokens": 300,
  "temperature": 0.7,
  "response_format": { "type": "json_object" },
  "model": "gpt-4o"
}
```

Response: the raw OpenAI completion shape, so the client reads
`data.choices[0].message.content` unchanged.

The handler whitelists models (`gpt-4o`, `gpt-4o-mini`), caps `max_tokens` and
the number of messages, and applies a 30s upstream timeout to bound cost/abuse.

## Deploy — Vercel (recommended)

1. `cd server`
2. Vercel auto-routes `api/ai.js` to `/api/ai`. Add the secret:
   - Vercel dashboard → Project → Settings → Environment Variables →
     `OPENAI_API_KEY = sk-...`
   - or CLI: `vercel env add OPENAI_API_KEY`
3. `vercel --prod`
4. Copy the deployed URL and set it in the app config (`app.config.js`):
   ```js
   extra: {
     aiProxyUrl: process.env.AI_PROXY_URL || "https://<your-app>.vercel.app/api/ai",
     // ...
   }
   ```
   Then rebuild the app (`npx expo start --clear` for dev, or a new EAS build).

## Deploy — any Node host (Render / Railway / Fly / a VM)

1. `cd server && npm install` (no deps required; Node ≥ 18 has global `fetch`).
2. Set `OPENAI_API_KEY` in the host's environment.
3. `npm start` (serves `POST /api/ai` and `GET /health` on `PORT`, default 8787).
4. Put it behind HTTPS and point `extra.aiProxyUrl` at `https://<host>/api/ai`.

## Local development

```bash
cd server
cp .env.example .env   # fill in OPENAI_API_KEY
OPENAI_API_KEY=sk-... node index.js
# → AI proxy listening on http://localhost:8787/api/ai
```

For a device/simulator to reach your machine, expose it (e.g. `npx localtunnel
--port 8787` or ngrok) and set `EXPO_PUBLIC_AI_PROXY_URL` to that URL.

## Hardening checklist (production)

- Restrict CORS `Access-Control-Allow-Origin` to your own domain(s).
- Add rate limiting / per-device quotas (e.g. a token or App Attest / Play
  Integrity check) so the open endpoint can't be abused.
- Keep the model whitelist and `max_tokens` cap tight.
- Never log full request bodies (they may contain user health context — report
  D3) or the API key.
