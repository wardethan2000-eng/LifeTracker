import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxyToApi } from "../../../lib/api-proxy";

vi.mock("../../../lib/api", () => ({
  getApiBaseUrl: () => "http://api.example.test",
  getDevUserId: () => "dev-user-id"
}));

describe("proxyToApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards Better Auth routes to /api/auth/*", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("null", {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    const response = await proxyToApi(
      new Request("http://web.example.test/api/auth/sign-in/email?next=%2F", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: "user@example.com",
          password: "hunter2"
        })
      }),
      "auth/sign-in/email"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL);
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe("http://api.example.test/api/auth/sign-in/email?next=%2F");
    expect(response.status).toBe(200);
  });

  it("preserves auth cookies from proxied responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "better-auth.session_token=session123; Path=/; HttpOnly"
        }
      })
    );

    const response = await proxyToApi(
      new Request("http://web.example.test/api/auth/get-session"),
      "auth/get-session"
    );

    expect(response.headers.get("set-cookie")).toContain("better-auth.session_token=session123");
    expect(response.headers.get("content-type")).toBe("application/json");
  });
});
