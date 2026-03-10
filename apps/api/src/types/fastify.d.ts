import type { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../plugins/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    auth: AuthContext;
  }
}
