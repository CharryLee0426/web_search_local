"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { MessageBubble } from "@/components/MessageBubble";
import { Sidebar } from "@/components/Sidebar";
import {
  createId,
  DEFAULT_SETTINGS,
  loadActiveId,
  loadConversations,
  loadSettings,
  saveActiveId,
  saveConversations,
  saveSettings,
  titleFromPrompt,
} from "@/lib/storage";
import type {
  ChatMessage,
  Conversation,
  ChatSettings,
  ModelInfo,
  StreamEvent,
  ThinkingStep,
} from "@/lib/types";

const SUGGESTIONS = [
  {
    title: "Local weather",
    prompt: "What will the weather be next week in San Jose, California?",
  },
  {
    title: "AI news briefing",
    prompt: "Summarize the top AI news this week with sources.",
  },
  {
    title: "Live sports research",
    prompt: "Which teams have qualified for the 2026 World Cup?",
  },
];

export function ChatApp() {
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Thinking…");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [gatewayLabel, setGatewayLabel] = useState("Gateway…");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedConversations = loadConversations();
    const storedActive = loadActiveId();
    const storedSettings = loadSettings();
    /* eslint-disable react-hooks/set-state-in-effect -- intentional client-only hydration */
    setConversations(storedConversations);
    setSettings(storedSettings);
    setActiveId(
      storedActive && storedConversations.some((item) => item.id === storedActive)
        ? storedActive
        : storedConversations[0]?.id ?? null,
    );
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveConversations(conversations);
  }, [conversations, ready]);

  useEffect(() => {
    if (!ready) return;
    saveActiveId(activeId);
  }, [activeId, ready]);

  useEffect(() => {
    if (!ready) return;
    saveSettings(settings);
  }, [settings, ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        const data = await response.json();
        if (cancelled) return;

        const list: ModelInfo[] = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.fallback)
            ? data.fallback
            : [];
        setModels(list);
        setGatewayLabel(data.gateway ? String(data.gateway) : "Gateway unreachable");

        if (list.length && !list.some((model) => model.id === settings.model)) {
          setSettings((current) => ({ ...current, model: list[0].id }));
        }
      } catch {
        if (!cancelled) setGatewayLabel("Gateway unreachable");
      }
    }

    void loadModels();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages, isStreaming, statusLabel]);

  const ensureConversation = useCallback((): Conversation => {
    if (activeConversation) return activeConversation;
    const created: Conversation = {
      id: createId("chat"),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((current) => [created, ...current]);
    setActiveId(created.id);
    return created;
  }, [activeConversation]);

  const updateConversation = useCallback(
    (id: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id ? updater(conversation) : conversation,
        ),
      );
    },
    [],
  );

  const patchAssistant = useCallback(
    (
      conversationId: string,
      assistantId: string,
      patch: (message: ChatMessage) => ChatMessage,
    ) => {
      updateConversation(conversationId, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === assistantId ? patch(message) : message,
        ),
        updatedAt: Date.now(),
      }));
    },
    [updateConversation],
  );

  const handleNewChat = useCallback(() => {
    const created: Conversation = {
      id: createId("chat"),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations((current) => [created, ...current]);
    setActiveId(created.id);
    setDraft("");
    setError(null);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setConversations((current) => {
        const next = current.filter((item) => item.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
    },
    [activeId],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingId(null);
  }, []);

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isStreaming) return;

      setError(null);
      setDraft("");
      setStatusLabel(
        settings.enableWebTools
          ? "Thinking and researching with local web tools…"
          : "Thinking with the local model…",
      );

      const conversation = ensureConversation();
      const userMessage: ChatMessage = {
        id: createId("msg"),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      const assistantMessage: ChatMessage = {
        id: createId("msg"),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        thinking: [],
      };

      updateConversation(conversation.id, (current) => ({
        ...current,
        title:
          current.messages.length === 0 ? titleFromPrompt(text) : current.title,
        messages: [...current.messages, userMessage, assistantMessage],
        updatedAt: Date.now(),
      }));

      const history = [...conversation.messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }));

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStreamingId(assistantMessage.id);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: settings.model,
            temperature: settings.temperature,
            enable_web_tools: settings.enableWebTools,
            messages: history,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const parts = [payload?.error, payload?.detail, payload?.hint].filter(
            (part): part is string => typeof part === "string" && part.length > 0,
          );
          throw new Error(
            parts.length ? parts.join(" — ") : `Request failed with status ${response.status}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream from playground API");

        const decoder = new TextDecoder();
        let buffer = "";
        let assembled = "";
        const thinkingMap = new Map<string, ThinkingStep>();

        const flushThinking = () => {
          const steps = Array.from(thinkingMap.values());
          patchAssistant(conversation.id, assistantMessage.id, (message) => ({
            ...message,
            thinking: steps,
          }));
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(data) as StreamEvent;
            } catch {
              continue;
            }

            if (event.type === "status") {
              setStatusLabel(event.label);
              continue;
            }

            if (event.type === "thinking_step") {
              thinkingMap.set(event.step.id, event.step);
              flushThinking();
              continue;
            }

            if (event.type === "thinking_done") {
              patchAssistant(conversation.id, assistantMessage.id, (message) => ({
                ...message,
                thinkingDurationMs: event.durationMs,
                thinking: Array.from(thinkingMap.values()).map((step) => ({
                  ...step,
                  status: "done" as const,
                })),
              }));
              continue;
            }

            if (event.type === "content") {
              assembled += event.delta;
              const snapshot = assembled;
              patchAssistant(conversation.id, assistantMessage.id, (message) => ({
                ...message,
                content: snapshot,
              }));
              continue;
            }

            if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }

        if (!assembled.trim() && thinkingMap.size === 0) {
          patchAssistant(conversation.id, assistantMessage.id, (message) => ({
            ...message,
            content: message.content || "No content returned from the model.",
          }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Request failed";
        setError(message);
        patchAssistant(conversation.id, assistantMessage.id, (item) => ({
          ...item,
          content: item.content || `Error: ${message}`,
        }));
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setStreamingId(null);
      }
    },
    [
      ensureConversation,
      isStreaming,
      patchAssistant,
      settings,
      updateConversation,
    ],
  );

  if (!ready) {
    return <div className="app-shell loading-shell">Loading…</div>;
  }

  const messages = activeConversation?.messages ?? [];

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((value) => !value)}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((value) => !value)}
        settings={settings}
        onSettingsChange={setSettings}
        models={models}
        gatewayLabel={gatewayLabel}
      />

      <main className="chat-main">
        <header className="chat-header">
          <div className="model-pill" title={settings.model}>
            <span className="model-dot" />
            {settings.model}
          </div>
          <div className={`status-chip ${settings.enableWebTools ? "on" : "off"}`}>
            {settings.enableWebTools ? "Web tools on" : "Web tools off"}
          </div>
        </header>

        <div className="chat-scroll">
          {messages.length === 0 ? (
            <section className="empty-state">
              <div className="empty-hero">
                <h1>Local Web Search</h1>
                <p>
                  A modern chat playground for Ollama with live research tools —
                  search, read pages, news, and weather.
                </p>
              </div>
              <div className="suggestion-grid">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    className="suggestion-card"
                    onClick={() => void sendMessage(suggestion.prompt)}
                  >
                    <span className="suggestion-title">{suggestion.title}</span>
                    <span className="suggestion-prompt">{suggestion.prompt}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && message.id === streamingId}
                  statusLabel={statusLabel}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void sendMessage(draft)}
          onStop={handleStop}
          isStreaming={isStreaming}
          enableWebTools={settings.enableWebTools}
          onToggleWebTools={() =>
            setSettings((current) => ({
              ...current,
              enableWebTools: !current.enableWebTools,
            }))
          }
        />
      </main>
    </div>
  );
}
