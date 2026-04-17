import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authHandlerMock } = vi.hoisted(() => ({
  authHandlerMock: vi.fn(async (request: Request) => new Response(JSON.stringify({
    url: request.url,
    method: request.method,
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  })),
}));

vi.mock("../src/lib/auth.js", () => ({
  auth: {
    handler: authHandlerMock,
  },
}));

import { authRoutes } from "../src/routes/auth.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  authHandlerMock.mockClear();
  process.env = {
    ...originalEnv,
    APP_BASE_URL: "http://api.lifetracker.home",
  };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("authRoutes", () => {
  it("sanitizes malformed forwarded auth headers before building the Better Auth request URL", async () => {
    const app = Fastify();
    await app.register(authRoutes);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: {
          host: "\\api.lifetracker.home",
          "x-forwarded-proto": "\\http",
        },
        payload: {
          email: "wardethan2000@gmail.com",
          password: "secret",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(authHandlerMock).toHaveBeenCalledTimes(1);
      expect(authHandlerMock.mock.calls[0]?.[0]).toBeInstanceOf(Request);
      expect(authHandlerMock.mock.calls[0]?.[0].url).toBe("http://api.lifetracker.home/api/auth/sign-in/email");
      expect(response.json()).toEqual({
        url: "http://api.lifetracker.home/api/auth/sign-in/email",
        method: "POST",
      });
    } finally {
      await app.close();
    }
  });
});
