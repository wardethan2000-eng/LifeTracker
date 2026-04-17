import { getApiBaseUrl, getDevUserId } from "./api";

type StreamingRequestInit = RequestInit & {
  duplex: "half";
};

const hopByHopResponseHeaders = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const buildForwardedHeaders = (request: Request): Headers => {
  const headers = new Headers();

  for (const headerName of ["authorization", "cookie", "content-type", "accept"]) {
    const headerValue = request.headers.get(headerName);

    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  if (!headers.has("authorization")) {
    headers.set("x-dev-user-id", getDevUserId());
  }

  return headers;
};

const buildTargetUrl = (request: Request, pathSuffix: string): URL => {
  const requestUrl = new URL(request.url);
  const targetPath = pathSuffix.startsWith("auth/")
    ? `/api/${pathSuffix}`
    : `/v1/${pathSuffix}`;
  const apiUrl = new URL(targetPath, getApiBaseUrl());
  apiUrl.search = requestUrl.search;
  return apiUrl;
};

const createUnavailableResponse = (): Response => new Response(
  JSON.stringify({ message: "API unavailable." }),
  {
    status: 502,
    headers: {
      "content-type": "application/json"
    }
  }
);

const forwardResponse = (response: Response): Response => {
  const headers = new Headers();

  for (const [key, value] of response.headers.entries()) {
    if (!hopByHopResponseHeaders.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      headers.append(key, value);
    }
  }

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;

  if (typeof getSetCookie === "function") {
    for (const cookie of getSetCookie.call(response.headers)) {
      headers.append("set-cookie", cookie);
    }
  } else {
    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      headers.append("set-cookie", setCookie);
    }
  }

  return new Response(response.body, {
    status: response.status,
    headers
  });
};

const supportsRequestBody = (method: string, request: Request): boolean => (
  method !== "GET"
  && method !== "HEAD"
  && request.body !== null
);

export async function proxyToApi(request: Request, pathSuffix: string): Promise<Response> {
  const method = request.method.toUpperCase();
  const apiUrl = buildTargetUrl(request, pathSuffix);
  const headers = buildForwardedHeaders(request);
  const hasBody = supportsRequestBody(method, request);
  const fallbackRequest = hasBody ? request.clone() : null;

  const baseInit: RequestInit = {
    method,
    headers,
    cache: "no-store"
  };

  try {
    const response = await fetch(
      apiUrl,
      hasBody
        ? ({
            ...baseInit,
            body: request.body,
            duplex: "half"
          } as StreamingRequestInit)
        : baseInit
    );

    return forwardResponse(response);
  } catch {
    if (!fallbackRequest) {
      return createUnavailableResponse();
    }
  }

  try {
    const response = await fetch(apiUrl, {
      ...baseInit,
      body: await fallbackRequest.text()
    });

    return forwardResponse(response);
  } catch {
    return createUnavailableResponse();
  }
}
