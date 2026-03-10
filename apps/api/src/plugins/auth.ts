import fp from "fastify-plugin";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface AuthContext {
  userId: string;
}

const resolveUserId = (request: FastifyRequest): string | undefined => {
  const header = request.headers["x-user-id"];

  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }

  return undefined;
};

export const authPlugin = fp(async (app) => {
  app.decorateRequest("auth", undefined as unknown as AuthContext);

  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/health") {
      return;
    }

    const userId = resolveUserId(request);

    if (!userId) {
      await reply.code(401).send({
        message: "Missing x-user-id header. Clerk integration is planned for the next phase."
      });
      return;
    }

    request.auth = { userId };
  });
});
