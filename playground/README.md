# Local Web Search Playground

ChatGPT-style web UI for chatting with local Ollama models through this repo’s OpenAI-compatible gateway (web search, page reading, news, and weather tools).

Built with **Next.js**, **TypeScript**, and **Tailwind CSS**. Deployable on **Vercel**.

## Prerequisites

1. Ollama running locally with a tool-capable model (e.g. `qwen3.6:latest`)
2. This repo’s gateway running on port 8000:

```bash
# from the repo root
source .venv/bin/activate
./start_gateway.sh
```

## Local development

```bash
cd playground
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Env var | Default | Description |
|---------|---------|-------------|
| `GATEWAY_BASE_URL` | `http://127.0.0.1:8000` | Local web-search gateway |
| `GATEWAY_API_KEY` | `ollama` | Bearer token sent to the gateway |
| `DEFAULT_MODEL` | `qwen3.6:latest` | Default model in settings |

## Features

- Sidebar chat history (stored in `localStorage`)
- **Live thinking progress** — tool calls stream in realtime (DeepSeek-style collapsible panel)
- Streaming final answers via `/api/chat` → gateway `/v1/chat/completions`
- Toggle for `enable_web_tools`
- Model picker fed by gateway `/v1/models`
- Markdown rendering for assistant replies

## Deploy on Vercel

1. Import this Git repository in Vercel
2. Set **Root Directory** to `playground`
3. Add environment variables:
   - `GATEWAY_BASE_URL` — publicly reachable URL of your gateway (not `localhost` from Vercel’s servers)
   - `GATEWAY_API_KEY`
   - `DEFAULT_MODEL` (optional)
4. Deploy

Because Vercel cannot reach your laptop’s `localhost`, expose the gateway with a tunnel when using a hosted playground:

```bash
# example: Cloudflare Tunnel / ngrok pointing at :8000
ngrok http 8000
# then set GATEWAY_BASE_URL to the https URL ngrok prints
```

For fully local use, prefer `npm run dev` on the same machine as Ollama and the gateway.

## Project layout

```text
playground/
├── src/app/                 # Next.js App Router pages + API routes
│   ├── api/chat/route.ts    # Streams chat completions from the gateway
│   ├── api/models/route.ts  # Proxies /v1/models
│   ├── page.tsx
│   └── layout.tsx
├── src/components/          # ChatGPT-like UI
├── src/lib/                 # Types, localStorage, gateway helpers
├── .env.example
├── vercel.json
└── package.json
```
