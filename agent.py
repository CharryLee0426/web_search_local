#!/usr/bin/env python3
"""Interactive Ollama agent with local news_search / web_search / read_webpage / get_weather tools."""

from __future__ import annotations

import argparse

from runtime import OLLAMA_MODEL, run_agent


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Local Ollama research agent with web search tools.",
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        help="Single-shot prompt. If omitted, starts an interactive REPL.",
    )
    parser.add_argument(
        "--model",
        default=OLLAMA_MODEL,
        help=f"Ollama model name (default: {OLLAMA_MODEL})",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print tool calls and truncated results to stderr.",
    )
    args = parser.parse_args()

    if args.prompt:
        answer = run_agent(args.prompt, model=args.model, verbose=args.verbose)
        print(answer)
        return

    print(f"Local search agent ({args.model}). Enter 'exit' to stop.")
    print("Tip: use -v for tool traces, or pass a prompt as an argument.\n")
    print("Or start the OpenAI-compatible gateway for any Ollama client:")
    print("  python server.py\n")

    while True:
        try:
            prompt = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if prompt.lower() in {"exit", "quit"}:
            break
        if not prompt:
            continue

        answer = run_agent(prompt, model=args.model, verbose=args.verbose)
        print(f"\nAssistant: {answer}\n")


if __name__ == "__main__":
    main()
