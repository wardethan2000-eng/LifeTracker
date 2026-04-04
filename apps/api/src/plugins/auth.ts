import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../lib/auth.js";

export interface AuthContext {
  userId: string;
  clerkUserId: string | null;
  source: "better-auth" | "dev-bypass";
}

type AuthMode = "better-auth" | "dev-bypass";

interface AuthEnvironment {
  mode: AuthMode;
  allowDevBypass: boolean;
  defaultDevUserId: string | undefined;
}

const parseBoolean = (value: string | undefined): boolean => value === "true";

const resolveHeaderValue = (request: FastifyRequest, headerName: string): string | undefined => {
  const header = request.headers[headerName];

  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }

  return undefined;
};

const getAuthEnvironment = (): AuthEnvironment => ({
  mode: (process.env.AUTH_MODE as AuthMode | undefined) ?? "better-auth",
  allowDevBypass: parseBoolean(process.env.ALLOW_DEV_AUTH_BYPASS),
  defaultDevUserId: process.env.DEV_AUTH_DEFAULT_USER_ID?.trim() || undefined,
});

const isProductionEnvironment = (): boolean => process.env.NODE_ENV === "production";

const ensureAuthConfiguration = (env: AuthEnvironment): void => {
  if (isProductionEnvironment() && env.allowDevBypass) {
    throw new Error("ALLOW_DEV_AUTH_BYPASS must be false in production.");
  }

  if (!isProductionEnvironment() && !env.allowDevBypass && !process.env.BETTER_AUTH_SECRET) {
    throw new Error("Set BETTER_AUTH_SECRET or enable ALLOW_DEV_AUTH_BYPASS=true for local dev.");
  }
};

const resolveDevUserLookup = (request: FastifyRequest, env: AuthEnvironment): string | undefined => {
  const explicit = resolveHeaderValue(request, "x-dev-user-id") ?? resolveHeaderValue(request, "x-user-id");

  if (explicit) {
    return explicit;
  }

  return env.defaultDevUserId;
};

const resolveDevUser = async (request: FastifyRequest, lookup: string) =>
  request.server.prisma.user.findFirst({
    where: {
      OR: [
        { id: lookup },
        { clerkUserId: lookup },
        { email: lookup },
      ],
    },
  });

const authenticateWithBetterAuth = async (
  request: FastifyRequest
): Promise<AuthContext | null> => {
  // Build a Web API Headers object from Fastify's Node.js headers so BetterAuth
  // can read the session cookie / Authorization header.
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v);
      }
    }
  }

  const result = await auth.api.getSession({ headers });

  if (!result) {
    return null;
  }

  return {
    userId: result.user.id,
    clerkUserId: null,
    source: "better-auth",
  };
};

const authenticateWithDevBypass = async (
  request: FastifyRequest,
  env: AuthEnvironment
): Promise<AuthContext | null> => {
  if (!env.allowDevBypass || isProductionEnvironment()) {
    return null;
  }

  const lookup = resolveDevUserLookup(request, env);

  if (!lookup) {
    return null;
  }

  const user = await resolveDevUser(request, lookup);

  if (!user) {
    throw new Error(`Dev auth user '${lookup}' was not found.`);
  }

  return {
    userId: user.id,
    clerkUserId: user.clerkUserId ?? null,
    source: "dev-bypass",
  };
};

export const authPlugin = fp(async (app) => {
  const env = getAuthEnvironment();

  ensureAuthConfiguration(env);
  app.decorateRequest("auth", undefined as unknown as AuthContext);

  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/health") {
      return;
    }

    try {
      // 1. Try BetterAuth session (cookie or Bearer token set by better-auth client).
      if (env.mode !== "dev-bypass") {
        const betterAuthContext = await authenticateWithBetterAuth(request);

        if (betterAuthContext) {
          request.auth = betterAuthContext;
          return;
        }
      }

      // 2. Dev bypass (non-production only).
      const devContext = await authenticateWithDevBypass(request, env);

      if (devContext) {
        request.auth = devContext;
        return;
      }
    } catch (error) {
      await reply.code(401).send({
        message: error instanceof Error ? error.message : "Authentication failed.",
      });
      return;
    }

    await reply.code(401).send({
      message: env.allowDevBypass
        ? "Missing authentication. Provide a BetterAuth session or enable the dev bypass."
        : "Missing or invalid authentication.",
    });
  });
});
