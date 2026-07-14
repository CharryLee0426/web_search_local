import type { Conversation, ChatSettings } from "./types";

const CONVERSATIONS_KEY = "web-search-playground:conversations";
const ACTIVE_KEY = "web-search-playground:active-id";
const SETTINGS_KEY = "web-search-playground:settings";

export const DEFAULT_SETTINGS: ChatSettings = {
  model: "qwen3.6:latest",
  enableWebTools: true,
  temperature: 0.1,
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  return safeParse<Conversation[]>(localStorage.getItem(CONVERSATIONS_KEY), []);
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function loadSettings(): ChatSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...safeParse<Partial<ChatSettings>>(localStorage.getItem(SETTINGS_KEY), {}),
  };
}

export function saveSettings(settings: ChatSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function createId(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function titleFromPrompt(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}
