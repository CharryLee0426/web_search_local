#!/usr/bin/env python3
"""Quick smoke tests for local web tools (no LLM required)."""

from __future__ import annotations

import json
import sys

from tools import get_weather, read_webpage, web_search


def _print(label: str, payload: dict) -> None:
    print(f"\n=== {label} ===")
    print(json.dumps(payload, indent=2, ensure_ascii=False, default=str)[:2000])


def main() -> int:
    search = web_search("San Jose California weather forecast", max_results=3)
    _print("web_search", search)
    if search.get("error"):
        print("web_search failed", file=sys.stderr)
        return 1

    weather = get_weather("San Jose, California", forecast_days=3)
    _print("get_weather", weather)
    if weather.get("error"):
        print("get_weather failed", file=sys.stderr)
        return 1

    url = None
    for item in search.get("results") or []:
        if item.get("url"):
            url = item["url"]
            break

    if url:
        page = read_webpage(url, max_characters=2000)
        _print("read_webpage", page)

    wiki = read_webpage(
        "https://en.wikipedia.org/wiki/San_Jose,_California",
        max_characters=3000,
    )
    _print("read_webpage_wiki_chunk1", wiki)
    if wiki.get("error"):
        print("wiki read_webpage failed", file=sys.stderr)
        return 1
    if not wiki.get("has_more") or not wiki.get("next_offset"):
        print("expected wiki page to be longer than one chunk", file=sys.stderr)
        return 1
    if wiki.get("total_characters", 0) <= 3000:
        print("expected wiki total_characters > chunk size", file=sys.stderr)
        return 1

    wiki2 = read_webpage(
        "https://en.wikipedia.org/wiki/San_Jose,_California",
        max_characters=3000,
        start_offset=wiki["next_offset"],
    )
    _print("read_webpage_wiki_chunk2", wiki2)
    if wiki2.get("error"):
        print("wiki pagination failed", file=sys.stderr)
        return 1
    if wiki2.get("start_offset") != wiki["next_offset"]:
        print("pagination start_offset mismatch", file=sys.stderr)
        return 1
    if not wiki2.get("content"):
        print("expected non-empty second wiki chunk", file=sys.stderr)
        return 1

    blocked = read_webpage("http://127.0.0.1/")
    _print("ssrf_block", blocked)
    if "error" not in blocked:
        print("SSRF protection failed", file=sys.stderr)
        return 1

    print("\nAll smoke tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
