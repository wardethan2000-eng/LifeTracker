import type { User } from "@prisma/client";
import { verifyToken } from "@clerk/backend";
import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface AuthContext {
  userId: string;
  clerkUserId: string | null;
  source: "clerk" | "dev-bypass";
}

type AuthMode = "clerk" | "hybrid" | "dev-bypass";

interface AuthEnvironment {
  mode: AuthMode;
  allowDevBypass: boolean;
  defaultDevUserId: string | undefined;
  secretKey: string | undefined;
  jwtKey: string | undefined;
  authorizedParties: string[];
}

const resolveHeaderValue = (request: FastifyRequest, headerName: string): string | undefined => {
  const header = request.headers[headerName];

  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }

  return undefined;
};

const parseBoolean = (value: string | undefined): boolean => value === "true";

const parseList = (value: string | undefined): string[] => value
  ?.split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0) ?? [];

const getAuthEnvironment = (): AuthEnvironment => ({
  mode: (process.env.AUTH_MODE as AuthMode | undefined) ?? "hybrid",
  allowDevBypass: parseBoolean(process.env.ALLOW_DEV_AUTH_BYPASS),
  defaultDevUserId: process.env.DEV_AUTH_DEFAULT_USER_ID?.trim() || undefined,
  secretKey: process.env.CLERK_SECRET_KEY?.trim() || undefined,
  jwtKey: process.env.CLERK_JWT_KEY?.trim() || undefined,
  authorizedParties: parseList(process.env.CLERK_AUTHORIZED_PARTIES)
});

const getBearerToken = (request: FastifyRequest): string | undefined => {
  const header = resolveHeaderValue(request, "authorization");

  if (!header) {
    return undefined;
  }

  const [scheme, value] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return undefined;
  }

  return value.trim() || undefined;
};

const getCookieToken = (request: FastifyRequest): string | undefined => {
  const cookieHeader = resolveHeaderValue(request, "cookie");

  if (!cookieHeader) {
    return undefined;
  }

  for (const chunk of cookieHeader.split(";")) {
    const [name, ...rest] = chunk.trim().split("=");

    if (name === "__session") {
      const value = rest.join("=").trim();
      return value.length > 0 ? decodeURIComponent(value) : undefined;
    }
  }

  return undefined;
};

const getClerkToken = (request: FastifyRequest): string | undefined => getBearerToken(request) ?? getCookieToken(request);

const resolveDevUserLookup = (request: FastifyRequest, env: AuthEnvironment): string | undefined => {
  const explicit = resolveHeaderValue(request, "x-dev-user-id") ?? resolveHeaderValue(request, "x-user-id");

  if (explicit) {
    return explicit;
  }

  return env.defaultDevUserId;
};

const isProductionEnvironment = (): boolean => process.env.NODE_ENV === "production";

const ensureAuthConfiguration = (env: AuthEnvironment): void => {
  if (isProductionEnvironment() && env.allowDevBypass) {
    throw new Error("ALLOW_DEV_AUTH_BYPASS must be false in production.");
  }

  if (env.mode === "clerk" && !env.secretKey && !env.jwtKey) {
    throw new Error("AUTH_MODE=clerk requires CLERK_SECRET_KEY or CLERK_JWT_KEY.");
  }

  if (env.mode === "hybrid" && !env.allowDevBypass && !env.secretKey && !env.jwtKey) {
    throw new Error("Hybrid auth requires Clerk configuration or ALLOW_DEV_AUTH_BYPASS=true.");
  }
};

const ensureLocalUser = async (request: FastifyRequest, clerkUserId: string): Promise<User> => request.server.prisma.user.upsert({
  where: { clerkUserId },
  update: {},
  create: { clerkUserId }
});

const resolveDevUser = async (request: FastifyRequest, lookup: string): Promise<User | null> => request.server.prisma.user.findFirst({
  where: {
    OR: [
      { id: lookup },
      { clerkUserId: lookup },
      { email: lookup }
    ]
  }
});

const authenticateWithClerk = async (
  request: FastifyRequest,
  token: string,
  env: AuthEnvironment
): Promise<AuthContext | null> => {
  if (!env.secretKey && !env.jwtKey) {
    return null;
  }

  const verifiedToken = await verifyToken(token, {
    ...(env.secretKey ? { secretKey: env.secretKey } : {}),
    ...(env.jwtKey ? { jwtKey: env.jwtKey } : {}),
    ...(env.authorizedParties.length > 0 ? { authorizedParties: env.authorizedParties } : {})
  });
  const clerkUserId = typeof verifiedToken.sub === "string" ? verifiedToken.sub : undefined;

  if (!clerkUserId) {
    throw new Error("Verified Clerk token is missing a user subject.");
  }

  const user = await ensureLocalUser(request, clerkUserId);

  return {
    userId: user.id,
    clerkUserId,
    source: "clerk"
  };
};

const authenticateWithDevBypass = async (
  request: FastifyRequest,
  env: AuthEnvironment
): Promise<AuthContext | null> => {
  if (!env.allowDevBypass) {
    return null;
  }

  if (isProductionEnvironment()) {
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
    clerkUserId: user.clerkUserId,
    source: "dev-bypass"
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

    const clerkToken = getClerkToken(request);

    try {
      if (clerkToken && env.mode !== "dev-bypass") {
        const auth = await authenticateWithClerk(request, clerkToken, env);

        if (auth) {
          request.auth = auth;
          return;
        }
      }

      if (clerkToken && env.mode === "dev-bypass") {
        await reply.code(401).send({
          message: "Authorization tokens are not accepted when AUTH_MODE=dev-bypass."
        });
        return;
      }

      if (!clerkToken && env.mode !== "clerk") {
        const auth = await authenticateWithDevBypass(request, env);

        if (auth) {
          request.auth = auth;
          return;
        }
      }
    } catch (error) {
      await reply.code(401).send({
        message: error instanceof Error ? error.message : "Authentication failed."
      });
      return;
    }

    await reply.code(401).send({
      message: env.mode === "clerk"
        ? "Missing or invalid Clerk authentication."
        : "Missing authentication. Provide a Clerk token or enable the development auth bypass."
    });
  });
});
