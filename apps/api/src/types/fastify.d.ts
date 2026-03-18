import type { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../plugins/auth.js";
import type { RequestAuditLogContext } from "../plugins/destructive-audit-log.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    auth: AuthContext;
    auditLogContext: RequestAuditLogContext | null;
  }
}
