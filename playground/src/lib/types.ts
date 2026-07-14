export type Role = "user" | "assistant" | "system";

export type ThinkingStepKind = "status" | "round" | "tool_call" | "tool_result";

export interface ThinkingStep {
  id: string;
  kind: ThinkingStepKind;
  title: string;
  detail?: string;
  status: "running" | "done";
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  thinking?: ThinkingStep[];
  thinkingDurationMs?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatSettings {
  model: string;
  enableWebTools: boolean;
  temperature: number;
}

export interface ModelInfo {
  id: string;
  object: string;
  owned_by?: string;
}

export type StreamEvent =
  | { type: "status"; phase: string; label: string }
  | {
      type: "thinking_step";
      step: ThinkingStep;
    }
  | { type: "thinking_done"; durationMs: number }
  | { type: "content"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };
