#!/usr/bin/env python3
"""
OpenAI-compatible gateway that wires local web tools into Ollama automatically.

Point any OpenAI-compatible client at:

    http://localhost:8000/v1

Examples: curl, Open WebUI, Continue, Cursor, openai Python SDK.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any

import ollama
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from runtime import OLLAMA_HOST, OLLAMA_MODEL, build_system_prompt, run_tool_loop

HOST = os.getenv("GATEWAY_HOST", "0.0.0.0")
PORT = int(os.getenv("GATEWAY_PORT", "8000"))

app = FastAPI(
    title="Local Web Search Gateway",
    description="OpenAI-compatible API that gives Ollama models web_search tools.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str | list[Any] | None = None
    name: str | None = None
    tool_call_id: str | None = None


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage]
    temperature: float | None = 0.1
    stream: bool = False
    max_tokens: int | None = None
    tools: list[Any] | None = None
    # Custom: set false to talk to the model without local web tools
    enable_web_tools: bool = True


def _message_content_to_text(content: str | list[Any] | None) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for item in content:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            if item.get("type") == "text":
                parts.append(str(item.get("text", "")))
            elif "text" in item:
                parts.append(str(item["text"]))
    return "\n".join(part for part in parts if part)


def _to_runtime_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    converted: list[dict[str, Any]] = []
    for message in messages:
        role = message.role
        if role not in {"system", "user", "assistant", "tool"}:
            role = "user"
        converted.append(
            {
                "role": role,
                "content": _message_content_to_text(message.content),
            }
        )
    return converted


def _completion_payload(model: str, content: str, tool_events: list[dict[str, Any]]) -> dict[str, Any]:
    created = int(time.time())
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
        "local_web_tools": {
            "enabled": True,
            "events": [
                event
                for event in tool_events
                if event.get("type") in {"tool_call", "tool_result", "round"}
            ],
        },
    }


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "name": "Local Web Search Gateway",
        "ollama_host": OLLAMA_HOST,
        "default_model": OLLAMA_MODEL,
        "openai_base_url": f"http://127.0.0.1:{PORT}/v1",
        "tools": ["news_search", "web_search", "read_webpage", "get_weather"],
        "hint": "POST /v1/chat/completions with OpenAI-compatible payloads.",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/models")
def list_models() -> dict[str, Any]:
    client = ollama.Client(host=OLLAMA_HOST)
    try:
        tags = client.list()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not reach Ollama: {exc}") from exc

    models = []
    for item in getattr(tags, "models", []) or []:
        name = getattr(item, "model", None) or getattr(item, "name", None)
        if not name:
            continue
        models.append(
            {
                "id": name,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "ollama+local-web-tools",
            }
        )

    if not models:
        models.append(
            {
                "id": OLLAMA_MODEL,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "ollama+local-web-tools",
            }
        )

    return {"object": "list", "data": models}


@app.post("/v1/chat/completions")
async def chat_completions(body: ChatCompletionRequest, request: Request) -> Any:
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    model = body.model or OLLAMA_MODEL
    temperature = 0.1 if body.temperature is None else float(body.temperature)
    runtime_messages = _to_runtime_messages(body.messages)

    # If the client already provided tools, we still inject ours unless disabled.
    enable_tools = body.enable_web_tools

    try:
        result = run_tool_loop(
            runtime_messages,
            model=model,
            temperature=temperature,
            enable_tools=enable_tools,
            verbose=os.getenv("GATEWAY_VERBOSE", "0") == "1",
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Ollama/tool loop failed: {exc}") from exc

    content = result["content"]
    payload = _completion_payload(model, content, result["tool_events"])

    if not body.stream:
        return JSONResponse(payload)

    async def event_stream():
        created = payload["created"]
        chunk_id = payload["id"]

        # Announce that tools may have been used, then stream the final answer.
        header = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": {"role": "assistant", "content": ""},
                    "finish_reason": None,
                }
            ],
        }
        yield _sse(header)

        # Stream in small chunks for UI responsiveness.
        step = 48
        for index in range(0, len(content), step):
            if await request.is_disconnected():
                return
            piece = content[index : index + step]
            yield _sse(
                {
                    "id": chunk_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": piece},
                            "finish_reason": None,
                        }
                    ],
                }
            )

        yield _sse(
            {
                "id": chunk_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "delta": {},
                        "finish_reason": "stop",
                    }
                ],
            }
        )
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/chat")
async def simple_chat(request: Request) -> dict[str, Any]:
    """Tiny non-OpenAI helper: {"message": "...", "model": "..."}."""
    data = await request.json()
    message = (data.get("message") or data.get("prompt") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    model = data.get("model") or OLLAMA_MODEL
    result = run_tool_loop(
        [
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": message},
        ],
        model=model,
        enable_tools=bool(data.get("enable_web_tools", True)),
        verbose=os.getenv("GATEWAY_VERBOSE", "0") == "1",
    )
    return {
        "model": model,
        "answer": result["content"],
        "tool_events": result["tool_events"],
    }


def main() -> None:
    print(f"Local Web Search Gateway")
    print(f"  OpenAI base URL : http://127.0.0.1:{PORT}/v1")
    print(f"  Ollama host     : {OLLAMA_HOST}")
    print(f"  Default model   : {OLLAMA_MODEL}")
    print(f"  Tools           : news_search, web_search, read_webpage, get_weather")
    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
