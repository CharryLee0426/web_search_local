"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "@/components/ThinkingBlock";
import type { ChatMessage } from "@/lib/types";

type MessageBubbleProps = {
  message: ChatMessage;
  isStreaming?: boolean;
  statusLabel?: string;
};

export function MessageBubble({
  message,
  isStreaming = false,
  statusLabel,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const showThinking =
    !isUser &&
    ((message.thinking && message.thinking.length > 0) ||
      (isStreaming && !message.content));

  return (
    <div className={`message-row ${isUser ? "is-user" : "is-assistant"}`}>
      {isUser ? (
        <div className="user-bubble whitespace-pre-wrap">{message.content}</div>
      ) : (
        <div className="assistant-stack">
          {showThinking ? (
            <ThinkingBlock
              steps={message.thinking ?? []}
              durationMs={message.thinkingDurationMs}
              active={isStreaming && !message.content}
              statusLabel={statusLabel}
            />
          ) : null}

          <div className="message-markdown prose-chat">
            {message.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            ) : isStreaming ? null : (
              <span className="muted">No content returned.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
