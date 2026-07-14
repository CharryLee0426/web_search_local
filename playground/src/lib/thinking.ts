import type { ThinkingStep } from "./types";

type GatewayToolEvent = {
  type?: string;
  round?: number;
  count?: number;
  name?: string;
  arguments?: unknown;
  result?: unknown;
};

function truncate(value: string, max = 280): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

function formatJson(value: unknown, max = 280): string {
  try {
    return truncate(JSON.stringify(value, null, 0), max);
  } catch {
    return truncate(String(value), max);
  }
}

function toolTitle(name: string | undefined): string {
  switch (name) {
    case "web_search":
      return "Searching the web";
    case "news_search":
      return "Scanning news sources";
    case "read_webpage":
      return "Reading a webpage";
    case "get_weather":
      return "Checking the weather";
    default:
      return name ? `Calling ${name}` : "Using a tool";
  }
}

function toolCallDetail(name: string | undefined, args: unknown): string | undefined {
  if (!args || typeof args !== "object") return formatJson(args);
  const record = args as Record<string, unknown>;
  if (name === "web_search" || name === "news_search") {
    return record.query ? `Query: ${String(record.query)}` : formatJson(args);
  }
  if (name === "read_webpage") {
    return record.url ? `URL: ${String(record.url)}` : formatJson(args);
  }
  if (name === "get_weather") {
    const place = [record.city, record.region, record.country].filter(Boolean).join(", ");
    return place || formatJson(args);
  }
  return formatJson(args);
}

function toolResultDetail(name: string | undefined, result: unknown): string | undefined {
  if (!result || typeof result !== "object") return formatJson(result);
  const record = result as Record<string, unknown>;
  if (typeof record.error === "string") return `Error: ${record.error}`;

  if (name === "web_search" || name === "news_search") {
    const count = record.result_count ?? (Array.isArray(record.results) ? record.results.length : null);
    const backend = record.backend ? ` via ${String(record.backend)}` : "";
    return count != null ? `Found ${count} result${Number(count) === 1 ? "" : "s"}${backend}` : formatJson(result);
  }
  if (name === "read_webpage") {
    const content = typeof record.content === "string" ? record.content : "";
    return content ? truncate(content, 220) : formatJson(result);
  }
  if (name === "get_weather") {
    return formatJson(result, 220);
  }
  return formatJson(result);
}

export function gatewayEventsToThinkingSteps(events: GatewayToolEvent[]): ThinkingStep[] {
  const steps: ThinkingStep[] = [];
  let index = 0;

  for (const event of events) {
    if (event.type === "round") {
      steps.push({
        id: `step_${index++}`,
        kind: "round",
        title: `Research round ${event.round ?? "?"}`.trim(),
        detail: event.count ? `${event.count} tool call${event.count === 1 ? "" : "s"}` : undefined,
        status: "done",
      });
      continue;
    }

    if (event.type === "tool_call") {
      steps.push({
        id: `step_${index++}`,
        kind: "tool_call",
        title: toolTitle(event.name),
        detail: toolCallDetail(event.name, event.arguments),
        status: "done",
      });
      continue;
    }

    if (event.type === "tool_result") {
      steps.push({
        id: `step_${index++}`,
        kind: "tool_result",
        title: `${toolTitle(event.name)} · result`,
        detail: toolResultDetail(event.name, event.result),
        status: "done",
      });
    }
  }

  return steps;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
