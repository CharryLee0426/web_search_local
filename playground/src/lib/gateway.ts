export function getGatewayBaseUrl(): string {
  const raw = process.env.GATEWAY_BASE_URL?.trim() || "http://127.0.0.1:8000";
  return raw.replace(/\/$/, "");
}

export function getGatewayApiKey(): string {
  return process.env.GATEWAY_API_KEY?.trim() || "ollama";
}

export function getDefaultModel(): string {
  return process.env.DEFAULT_MODEL?.trim() || "qwen3.6:latest";
}
