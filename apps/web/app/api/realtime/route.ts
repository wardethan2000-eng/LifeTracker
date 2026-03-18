import type { NextRequest } from "next/server";
import { addRealtimeClient, removeRealtimeClient, type RealtimeEvent } from "../../../lib/realtime-events";

export const runtime = "nodejs";

const encoder = new TextEncoder();

const serializeEvent = (event: RealtimeEvent): Uint8Array => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

export async function GET(request: NextRequest): Promise<Response> {
  const householdId = request.nextUrl.searchParams.get("householdId")?.trim();

  if (!householdId) {
    return new Response("Missing householdId.", { status: 400 });
  }

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = (): void => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }

        removeRealtimeClient(householdId, clientId);

        try {
          controller.close();
        } catch {
          // Ignore duplicate close attempts.
        }
      };

      addRealtimeClient(householdId, {
        id: clientId,
        send: (event) => controller.enqueue(serializeEvent(event)),
        close
      });

      controller.enqueue(encoder.encode(": connected\n\n"));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          close();
        }
      }, 25000);

      request.signal.addEventListener("abort", close);
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    }
  });
}