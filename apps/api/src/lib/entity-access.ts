import type { PrismaClient } from "@prisma/client";
import type { FastifyReply } from "fastify";

type GenericDelegate = {
  findFirst(args: { where: Record<string, unknown> }): Promise<unknown>;
};

/**
 * Fetch an entity by ID, verify it belongs to the given household, and return it.
 * When the entity is missing or belongs to a different household, sends a 404
 * response and returns `null` so the caller can do `if (!entity) return reply`.
 *
 * Use this for models with a top-level `householdId` field (Project, Asset,
 * InventoryItem, etc.). For entities accessed through relations (e.g.
 * MaintenanceSchedule → Asset), use the domain-specific helpers such as
 * `getAccessibleAsset` instead.
 *
 * @param prisma          - Prisma client instance (or transaction)
 * @param model           - Prisma model name in camelCase, e.g. `"project"`
 * @param entityId        - The entity's primary-key ID
 * @param householdId     - The household the caller has access to
 * @param reply           - Fastify reply (used to send the 404 when not found)
 * @param additionalWhere - Extra conditions merged into the where clause.
 *                          Pass `{ deletedAt: null }` for soft-deletable models
 *                          such as Project.
 *
 * @example
 * ```ts
 * const project = await findOwnedEntity<Project>(
 *   app.prisma, "project", params.projectId, params.householdId, reply,
 *   { deletedAt: null }
 * );
 * if (!project) return reply;
 * ```
 */
export async function findOwnedEntity<T>(
  prisma: PrismaClient,
  model: string,
  entityId: string,
  householdId: string,
  reply: FastifyReply,
  additionalWhere: Record<string, unknown> = {}
): Promise<T | null> {
  const delegate = (prisma as unknown as Record<string, GenericDelegate>)[model];

  if (!delegate?.findFirst) {
    throw new Error(`findOwnedEntity: unknown prisma model "${model}"`);
  }

  const result = (await delegate.findFirst({
    where: { id: entityId, householdId, ...additionalWhere }
  })) as T | null;

  if (!result) {
    reply.code(404).send({ message: "Not found." });
    return null;
  }

  return result;
}
