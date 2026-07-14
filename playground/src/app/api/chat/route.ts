import { getGatewayApiKey, getGatewayBaseUrl, getDefaultModel } from "@/lib/gateway";
import { gatewayEventsToThinkingSteps } from "@/lib/thinking";
import type { StreamEvent, ThinkingStep } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type IncomingMessage = {
  role: string;
  content: string;
};

type ChatBody = {
  messages?: IncomingMessage[];
  model?: string;
  temperature?: number;
  enable_web_tools?: boolean;
};

function sse(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function toThinkingSteps(rawEvent: unknown, index: number): ThinkingStep[] {
  return gatewayEventsToThinkingSteps([rawEvent as never]).map((step, offset) => ({
    ...step,
    id: `live_${index}_${offset}`,
  }));
}

export async function POST(request: Request) {
  let body: ChatBody;

  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.messages?.length) {
    return Response.json({ error: "messages must not be empty" }, { status: 400 });
  }

  const baseUrl = getGatewayBaseUrl();
  const enableTools = body.enable_web_tools ?? true;
  const payload = {
    model: body.model || getDefaultModel(),
    messages: body.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    temperature: body.temperature ?? 0.1,
    enable_web_tools: enableTools,
    stream: true,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(sse(event)));
      };

      const startedAt = Date.now();
      send({
        type: "status",
        phase: "waiting",
        label: enableTools
          ? "Thinking and researching with local web tools…"
          : "Thinking with the local model…",
      });

      let upstream: Response;
      try {
        upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getGatewayApiKey()}`,
          },
          body: JSON.stringify(payload),
          signal: request.signal,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({
          type: "error",
          message: `Could not reach gateway at ${baseUrl}. Start ./start_gateway.sh — ${message}`,
        });
        send({ type: "done" });
        controller.close();
        return;
      }

      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text();
        send({
          type: "error",
          message: `Gateway returned ${upstream.status}: ${detail.slice(0, 400)}`,
        });
        send({ type: "done" });
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let stepIndex = 0;
      let sawToolEvent = false;
      let finishedThinking = false;

      const finishThinking = () => {
        if (finishedThinking) return;
        finishedThinking = true;
        if (!sawToolEvent) {
          const fallback: ThinkingStep = {
            id: "step_plan",
            kind: "status",
            title: enableTools ? "Prepared an answer" : "Reasoned without tools",
            detail: enableTools
              ? "The model responded without calling web tools."
              : "Web tools were disabled for this reply.",
            status: "done",
          };
          send({ type: "thinking_step", step: fallback });
        }
        send({ type: "thinking_done", durationMs: Date.now() - startedAt });
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;

            let chunk: Record<string, unknown>;
            try {
              chunk = JSON.parse(data) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (chunk.object === "error") {
              const err = chunk.error as { message?: string } | undefined;
              send({
                type: "error",
                message: err?.message || "Gateway stream error",
              });
              continue;
            }

            if (chunk.object === "local_web_tools.status") {
              send({
                type: "status",
                phase: String(chunk.phase || "thinking"),
                label: String(chunk.label || "Thinking…"),
              });
              continue;
            }

            if (chunk.object === "local_web_tools.event") {
              sawToolEvent = true;
              const steps = toThinkingSteps(chunk.event, stepIndex++);
              for (const step of steps) {
                send({ type: "thinking_step", step: { ...step, status: "running" } });
                send({ type: "thinking_step", step });
              }
              continue;
            }

            if (chunk.object === "chat.completion.chunk") {
              const choices = chunk.choices as
                | Array<{ delta?: { content?: string }; finish_reason?: string | null }>
                | undefined;
              const delta = choices?.[0]?.delta?.content;
              if (delta) {
                finishThinking();
                send({ type: "content", delta });
              }
            }
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          const message = error instanceof Error ? error.message : "Stream failed";
          send({ type: "error", message });
        }
      }

      finishThinking();
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
