import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createLoanSchema, updateLoanSchema } from "@aegis/types";
import { assertMembership } from "../../lib/asset-access.js";
import { toLoanResponse } from "../../lib/serializers/index.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { forbidden, notFound, badRequest } from "../../lib/errors.js";
import { householdParamsSchema } from "../../lib/schemas.js";

const loanParamsSchema = householdParamsSchema.extend({
  loanId: z.string().cuid()
});

const listQuerySchema = z.object({
  status: z.enum(["active", "returned", "all"]).default("all"),
  entityType: z.enum(["asset", "inventory_item"]).optional(),
  entityId: z.string().cuid().optional()
});

async function resolveEntityName(
  prisma: Parameters<typeof assertMembership>[0],
  entityType: string,
  entityId: string
): Promise<string | undefined> {
  if (entityType === "asset") {
    const asset = await prisma.asset.findUnique({ where: { id: entityId }, select: { name: true } });
    return asset?.name;
  }
  if (entityType === "inventory_item") {
    const item = await prisma.inventoryItem.findUnique({ where: { id: entityId }, select: { name: true } });
    return item?.name;
  }
  return undefined;
}

export const loanRoutes: FastifyPluginAsync = async (app) => {
  // ── LIST ──────────────────────────────────────────────────────────
  app.get("/v1/households/:householdId/loans", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listQuerySchema.parse(request.query);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const where: Record<string, unknown> = { householdId: params.householdId };
    if (query.status === "active") where.returnedAt = null;
    else if (query.status === "returned") where.returnedAt = { not: null };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;

    const loans = await app.prisma.loan.findMany({
      where,
      orderBy: { lentAt: "desc" }
    });

    const withNames = await Promise.all(loans.map(async (loan) => {
      const entityName = await resolveEntityName(app.prisma, loan.entityType, loan.entityId);
      return toLoanResponse({ ...loan, entityName });
    }));
    return withNames;
  });

  // ── GET ───────────────────────────────────────────────────────────
  app.get("/v1/households/:householdId/loans/:loanId", async (request, reply) => {
    const params = loanParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const loan = await app.prisma.loan.findFirst({
      where: { id: params.loanId, householdId: params.householdId }
    });
    if (!loan) return notFound(reply, "Loan");

    const entityName = await resolveEntityName(app.prisma, loan.entityType, loan.entityId);
    return toLoanResponse({ ...loan, entityName });
  });

  // ── CREATE ────────────────────────────────────────────────────────
  app.post("/v1/households/:householdId/loans", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createLoanSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    // Validate that the entity exists in this household
    if (input.entityType === "asset") {
      const asset = await app.prisma.asset.findFirst({ where: { id: input.entityId, householdId: params.householdId, deletedAt: null } });
      if (!asset) return badRequest(reply, "Asset not found in this household.");
    } else {
      const item = await app.prisma.inventoryItem.findFirst({ where: { id: input.entityId, householdId: params.householdId, deletedAt: null } });
      if (!item) return badRequest(reply, "Inventory item not found in this household.");
    }

    const loan = await app.prisma.loan.create({
      data: {
        householdId: params.householdId,
        entityType: input.entityType,
        entityId: input.entityId,
        borrowerName: input.borrowerName,
        borrowerContact: input.borrowerContact ?? null,
        quantity: input.quantity ?? null,
        notes: input.notes ?? null,
        lentAt: input.lentAt ? new Date(input.lentAt) : new Date(),
        expectedReturnAt: input.expectedReturnAt ? new Date(input.expectedReturnAt) : null
      }
    });

    const entityName = await resolveEntityName(app.prisma, loan.entityType, loan.entityId);
    await createActivityLogger(app.prisma, request.auth.userId).log("loan", loan.id, "loan.created", params.householdId, { borrowerName: loan.borrowerName, entityName });
    return reply.code(201).send(toLoanResponse({ ...loan, entityName }));
  });

  // ── UPDATE ────────────────────────────────────────────────────────
  app.patch("/v1/households/:householdId/loans/:loanId", async (request, reply) => {
    const params = loanParamsSchema.parse(request.params);
    const input = updateLoanSchema.parse(request.body);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const existing = await app.prisma.loan.findFirst({ where: { id: params.loanId, householdId: params.householdId } });
    if (!existing) return notFound(reply, "Loan");

    const loan = await app.prisma.loan.update({
      where: { id: params.loanId },
      data: {
        ...(input.borrowerName !== undefined ? { borrowerName: input.borrowerName } : {}),
        ...(input.borrowerContact !== undefined ? { borrowerContact: input.borrowerContact } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.expectedReturnAt !== undefined ? { expectedReturnAt: input.expectedReturnAt ? new Date(input.expectedReturnAt) : null } : {}),
        ...(input.returnedAt !== undefined ? { returnedAt: input.returnedAt ? new Date(input.returnedAt) : null } : {})
      }
    });

    const entityName = await resolveEntityName(app.prisma, loan.entityType, loan.entityId);
    const action = input.returnedAt !== undefined ? "loan.returned" : "loan.updated";
    await createActivityLogger(app.prisma, request.auth.userId).log("loan", loan.id, action, params.householdId, { borrowerName: loan.borrowerName });
    return toLoanResponse({ ...loan, entityName });
  });

  // ── DELETE ────────────────────────────────────────────────────────
  app.delete("/v1/households/:householdId/loans/:loanId", async (request, reply) => {
    const params = loanParamsSchema.parse(request.params);
    try { await assertMembership(app.prisma, params.householdId, request.auth.userId); } catch { return forbidden(reply); }

    const existing = await app.prisma.loan.findFirst({ where: { id: params.loanId, householdId: params.householdId } });
    if (!existing) return notFound(reply, "Loan");

    await app.prisma.loan.delete({ where: { id: params.loanId } });
    await createActivityLogger(app.prisma, request.auth.userId).log("loan", params.loanId, "loan.deleted", params.householdId, { borrowerName: existing.borrowerName });
    return reply.code(204).send();
  });
};
