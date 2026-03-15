import type { NextRequest } from "next/server";
import { getApiBaseUrl, getDevUserId } from "../../../../../lib/api";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { householdId } = await context.params;
  const apiUrl = new URL(`${getApiBaseUrl()}/v1/households/${householdId}/link-preview`);

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");
  const contentType = request.headers.get("content-type");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (!authorization) {
    headers.set("x-dev-user-id", getDevUserId());
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: await request.text(),
    cache: "no-store"
  });

  const proxyHeaders = new Headers();
  const responseContentType = response.headers.get("content-type");

  if (responseContentType) {
    proxyHeaders.set("content-type", responseContentType);
  }

  return new Response(response.body, {
    status: response.status,
    headers: proxyHeaders
  });
}