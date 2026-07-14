"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef } from "react";
import { ArrowUp, Globe, Square } from "lucide-react";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isStreaming: boolean;
  enableWebTools: boolean;
  onToggleWebTools: () => void;
  disabled?: boolean;
};

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  enableWebTools,
  onToggleWebTools,
  disabled,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (isStreaming || disabled || !value.trim()) return;
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-shell">
        <textarea
          ref={textareaRef}
          className="composer-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything"
          rows={1}
          disabled={disabled}
        />
        <div className="composer-toolbar">
          <button
            type="button"
            className={`tool-chip ${enableWebTools ? "active" : ""}`}
            onClick={onToggleWebTools}
            title="Toggle web search tools"
          >
            <Globe size={15} />
            Search
          </button>
          {isStreaming ? (
            <button type="button" className="send-btn stop" onClick={onStop} aria-label="Stop">
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="send-btn"
              disabled={disabled || !value.trim()}
              aria-label="Send"
            >
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
