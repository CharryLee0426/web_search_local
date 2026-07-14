import { NextResponse } from "next/server";
import { getGatewayApiKey, getGatewayBaseUrl, getDefaultModel } from "@/lib/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getGatewayBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${getGatewayApiKey()}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          error: `Gateway returned ${response.status}`,
          detail,
          gateway: baseUrl,
          fallback: [{ id: getDefaultModel(), object: "model" }],
        },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      gateway: baseUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Could not reach gateway at ${baseUrl}`,
        detail: message,
        gateway: baseUrl,
        fallback: [{ id: getDefaultModel(), object: "model" }],
      },
      { status: 502 },
    );
  }
}
