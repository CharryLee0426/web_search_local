"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle, Sparkles } from "lucide-react";
import type { ThinkingStep } from "@/lib/types";

type ThinkingBlockProps = {
  steps: ThinkingStep[];
  durationMs?: number;
  active: boolean;
  statusLabel?: string;
};

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return "";
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s`;
}

export function ThinkingBlock({
  steps,
  durationMs,
  active,
  statusLabel,
}: ThinkingBlockProps) {
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? active;

  const label = active
    ? statusLabel || "Thinking"
    : `Thought for ${formatDuration(durationMs) || "a moment"}`;

  return (
    <div className={`thinking-block ${active ? "is-active" : "is-done"}`}>
      <button
        type="button"
        className="thinking-toggle"
        onClick={() => setManualOpen((current) => !(current ?? active))}
        aria-expanded={open}
      >
        <span className="thinking-toggle-main">
          {active ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>{label}</span>
          {active ? <span className="thinking-shimmer" aria-hidden /> : null}
        </span>
        <ChevronDown
          size={16}
          className={`thinking-chevron ${open ? "open" : ""}`}
        />
      </button>

      {open ? (
        <div className="thinking-panel">
          {active && steps.length === 0 ? (
            <div className="thinking-step running">
              <div className="thinking-step-title">{statusLabel || "Working…"}</div>
              <div className="thinking-step-detail">
                Waiting for the local model and web tools to respond.
              </div>
            </div>
          ) : null}

          {steps.map((step) => (
            <div
              key={step.id}
              className={`thinking-step ${step.status === "running" ? "running" : "done"}`}
            >
              <div className="thinking-step-title">{step.title}</div>
              {step.detail ? (
                <div className="thinking-step-detail">{step.detail}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
