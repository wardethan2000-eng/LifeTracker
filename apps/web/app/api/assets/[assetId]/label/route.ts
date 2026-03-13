import type { NextRequest } from "next/server";
import { getApiBaseUrl, getDevUserId } from "../../../../../lib/api";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { assetId } = await context.params;
  const requestUrl = new URL(request.url);
  const apiUrl = new URL(`${getApiBaseUrl()}/v1/assets/${assetId}/label`);
  apiUrl.search = requestUrl.search;

  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  if (authorization) {
    headers.set("authorization", authorization);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  if (!authorization) {
    headers.set("x-dev-user-id", getDevUserId());
  }

  const response = await fetch(apiUrl, {
    headers,
    cache: "no-store"
  });

  const proxyHeaders = new Headers();
  const contentType = response.headers.get("content-type");

  if (contentType) {
    proxyHeaders.set("content-type", contentType);
  }

  return new Response(response.body, {
    status: response.status,
    headers: proxyHeaders
  });
}