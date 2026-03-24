import type { PrismaClient } from "@prisma/client";
import type { AuthContext } from "../plugins/auth.js";
import type { RequestAuditLogContext } from "../plugins/destructive-audit-log.js";
import type { HouseholdContext } from "../plugins/household-context.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    auth: AuthContext;
    auditLogContext: RequestAuditLogContext | null;
    householdContext: HouseholdContext;
  }
}
