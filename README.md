# Local Web Search for Ollama

Give local Ollama models OpenAI-style web research capabilities — search the live web, read pages, and fetch structured weather — without paid LLM APIs.

Ollama runs the model. This project runs the tools.

```text
Client (curl / Open WebUI / OpenAI SDK / CLI)
                 │
                 ▼
     ┌───────────────────────┐
     │  Gateway :8000 (/v1)  │  OpenAI-compatible API
     │  or agent.py / MCP    │
     └───────────┬───────────┘
                 │ tool calls
                 ▼
           Ollama + Qwen
                 │
                 ▼
     ┌───────────────────────┐
     │  web_search           │──► SearXNG (Docker) or DDGS
     │  read_webpage         │──► Trafilatura extraction
     │  get_weather          │──► Open-Meteo
     └───────────────────────┘
```

> **What “local” means:** the model, orchestration, and tool runtime run on your machine. Live search, weather, and news still require internet access.

---

## Features

| Tool | Description |
|------|-------------|
| `news_search` | Latest finance/politics headlines via Google News RSS + news backends, ranked toward reputable outlets |
| `web_search` | Metasearch via self-hosted [SearXNG](https://docs.searxng.org/) or [DDGS](https://pypi.org/project/ddgs/) fallback |
| `read_webpage` | Download a URL and extract readable article text |
| `get_weather` | Daily forecast via [Open-Meteo](https://open-meteo.com/) (no API key) |

Also included:

- **OpenAI-compatible gateway** — plug into any client that speaks `/v1/chat/completions`
- **TypeScript playground** — ChatGPT-style web UI under `playground/` (Vercel-ready)
- **CLI research agent** — interactive or one-shot prompts
- **MCP server** — reuse the same tools from MCP-capable apps
- **SQLite result cache** — fewer duplicate network calls
- **SSRF protections** — blocks private IPs, localhost, and metadata hosts

---

## Requirements

| Dependency | Notes |
|------------|--------|
| [Ollama](https://ollama.com) | Must be running (`curl http://localhost:11434/api/tags`) |
| Tool-capable model | e.g. `qwen3.6:latest`, `qwen3:14b`, or other models with tool calling |
| Python 3.10+ | Recommended: Homebrew `python3.12` |
| Docker (optional) | For self-hosted SearXNG |

---

## Installation

```bash
cd web_search

# Create and activate a virtual environment
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify tools (no LLM required)
python smoke_test.py
```

Confirm Ollama and your model:

```bash
ollama pull qwen3.6:latest   # if needed
curl http://localhost:11434/api/tags
```

---

## Quick start

### Option A — OpenAI-compatible gateway (recommended)

Ollama cannot execute tools by itself. The gateway sits in front of Ollama, runs tools automatically, and exposes a standard OpenAI API.

```bash
source .venv/bin/activate
./start_gateway.sh
# equivalent: python server.py
```

| Setting | Value |
|---------|--------|
| Base URL | `http://127.0.0.1:8000/v1` |
| API key | `ollama` (any non-empty string) |
| Model | `qwen3.6:latest` |

**curl**

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3.6:latest",
    "messages": [
      {
        "role": "user",
        "content": "What will the weather be next week in San Jose, California?"
      }
    ]
  }'
```

**Python (OpenAI SDK)**

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8000/v1", api_key="ollama")

response = client.chat.completions.create(
    model="qwen3.6:latest",
    messages=[
        {
            "role": "user",
            "content": "Summarize the top AI news this week with sources.",
        }
    ],
)
print(response.choices[0].message.content)
```

**Open WebUI**

1. Settings → Connections → OpenAI API  
2. API Base URL: `http://127.0.0.1:8000/v1`  
   (from Docker: `http://host.docker.internal:8000/v1`)  
3. API Key: `ollama`

### Option B — TypeScript playground (ChatGPT-style UI)

A Next.js app under `playground/` that talks to the same gateway. Start the gateway first, then:

```bash
cd playground
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Setting | Value |
|---------|--------|
| Gateway | `GATEWAY_BASE_URL` (default `http://127.0.0.1:8000`) |
| API key | `GATEWAY_API_KEY` (default `ollama`) |
| Model | Picked in the sidebar; default `qwen3.6:latest` |

**Deploy on Vercel:** set the project Root Directory to `playground`, then configure `GATEWAY_BASE_URL` to a publicly reachable gateway URL (Vercel cannot call your laptop’s `localhost` — use a tunnel such as ngrok). See [`playground/README.md`](playground/README.md) for details.

### Option C — CLI agent

```bash
source .venv/bin/activate

# Interactive
python agent.py -v

# One-shot
python agent.py -v "What will the weather be next week in San Jose, California?"
```

`-v` prints tool calls and truncated results to stderr.

### Option D — MCP server

```bash
source .venv/bin/activate
python mcp_server.py
```

Example MCP client config:

```json
{
  "mcpServers": {
    "local-web-tools": {
      "command": "/ABSOLUTE/PATH/TO/web_search/.venv/bin/python",
      "args": ["/ABSOLUTE/PATH/TO/web_search/mcp_server.py"]
    }
  }
}
```

---

## Project layout

```text
web_search/
├── server.py           # OpenAI-compatible gateway (port 8000)
├── agent.py            # Interactive / one-shot CLI agent
├── runtime.py          # Shared Ollama + tool-calling loop
├── tools.py            # web_search, read_webpage, get_weather
├── mcp_server.py       # MCP wrapper for the same tools
├── smoke_test.py       # Offline-ish tool smoke tests
├── start_gateway.sh    # Convenience launcher
├── compose.yaml        # SearXNG + Valkey
├── searxng/settings.yml
├── requirements.txt
├── playground/         # ChatGPT-style Next.js UI (TypeScript, Vercel)
└── README.md
```

---

## Search backends

| Backend | When to use |
|---------|-------------|
| `auto` (default) | Prefer SearXNG if `http://localhost:8080` is up; otherwise DDGS |
| `searxng` | Force local SearXNG |
| `ddgs` | Force DDGS metasearch (no Docker required) |

### Optional: start SearXNG

```bash
docker compose up -d
curl "http://localhost:8080/search?q=San+Jose+weather&format=json"
```

```bash
export SEARCH_BACKEND=searxng
```

---

## Configuration

All settings are environment variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_MODEL` | `qwen3.6:latest` | Default model name |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API base |
| `GATEWAY_HOST` | `0.0.0.0` | Gateway bind address |
| `GATEWAY_PORT` | `8000` | Gateway port |
| `GATEWAY_VERBOSE` | `0` | Set `1` to log tool traces |
| `SEARCH_BACKEND` | `auto` | `auto`, `searxng`, or `ddgs` |
| `SEARXNG_URL` | `http://localhost:8080` | SearXNG base URL |
| `DDGS_BACKEND` | `duckduckgo,bing,brave,yahoo` | DDGS engine preference |
| `CACHE_TTL_SECONDS` | `900` | SQLite cache TTL (`0` disables) |
| `CACHE_DB_PATH` | `./cache.db` | Cache database path |
| `MAX_RESPONSE_BYTES` | `5000000` | Max download size for `read_webpage` |
| `READ_DEFAULT_CHARACTERS` | `20000` | Default chunk size returned by `read_webpage` |
| `READ_MAX_CHARACTERS` | `80000` | Max chunk size per `read_webpage` call |
| `MAX_TOOL_ROUNDS` | `8` | Max tool loops per request |
| `REQUEST_TIMEOUT` | `15` | HTTP timeout (seconds) |

Example:

```bash
GATEWAY_PORT=8001 GATEWAY_VERBOSE=1 OLLAMA_MODEL=qwen3.6:latest python server.py
```

---

## How the tool loop works

1. The client sends a chat request.  
2. Qwen decides whether a tool is needed.  
3. Ollama returns a structured tool call.  
4. This project executes the tool locally.  
5. The result is appended to the conversation.  
6. The model either calls another tool or returns the final answer.

```text
News / finance / politics → news_search → read_webpage → cited briefing
Other research     → web_search → read_webpage → cited answer
Weather question  → get_weather → Open-Meteo JSON → summary
```

---

## Example prompts

```text
What will the weather be next week in San Jose, California?
```

```text
Which teams have qualified for the 2026 World Cup?
Use current sources and cite URLs.
```

```text
Summarize the top AI news from the past week with sources.
```

---

## Security

`read_webpage` treats the public internet as untrusted input.

Blocked by default:

- `localhost`, `.local`, `.internal`
- Private, loopback, link-local, and reserved IP ranges
- Cloud metadata hosts
- Non-`http` / `https` schemes
- Oversized responses

Retrieved content is labeled **UNTRUSTED WEB CONTENT**. The system prompt instructs the model to extract facts only and ignore instructions found inside pages.

---

## Troubleshooting

### `Address already in use` (port 8000)

Another process is already bound to the gateway port (often a previous `server.py`).

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
kill <PID>
```

Or use a different port:

```bash
GATEWAY_PORT=8001 python server.py
```

### Gateway cannot reach Ollama

```bash
curl http://localhost:11434/api/tags
```

Ensure Ollama is running and `OLLAMA_HOST` is correct.

### Empty or failed search results

- Check internet connectivity.
- Try `export SEARCH_BACKEND=ddgs`.
- If using SearXNG: `docker compose ps` and test `http://localhost:8080`.

### Model never calls tools

Use a tool-capable model (Qwen 3 / Qwen 3.6 families work well). Confirm with:

```bash
python agent.py -v "What is the weather in Tokyo tomorrow?"
```

You should see a `get_weather` tool trace on stderr.

---

## License

Use and modify freely for local research and development. Respect the terms of upstream services (SearXNG engines, Open-Meteo, and any sites you fetch).
