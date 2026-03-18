import type { Prisma } from "@prisma/client";
import {
  bulkPartsReadinessSchema,
  createInventoryItemSchema,
  inventoryItemMergeResultSchema,
  inventoryItemSummarySchema,
  inventoryItemTypeSchema,
  mergeInventoryItemsSchema,
  updateInventoryItemSchema
} from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../../lib/asset-access.js";
import { logActivity } from "../../lib/activity-log.js";
import { emitDomainEvent } from "../../lib/domain-events.js";
import {
  applyInventoryTransaction,
  computeBulkSchedulePartsReadiness,
  getHouseholdInventoryItem,
  InventoryError,
  mergeHouseholdInventoryItems
} from "../../lib/inventory.js";
import { getSpaceBreadcrumb } from "../../lib/spaces.js";
import { toMaintenanceScheduleResponse } from "../../lib/schedule-state.js";
import {
  toInventoryItemDetailResponse,
  toInventoryItemSummaryResponse,
  toLowStockInventoryItemResponse
} from "../../lib/serializers/index.js";
import { calculateInventoryDeficit } from "@lifekeeper/utils";
import { syncInventoryItemToSearchIndex, removeSearchIndexEntry } from "../../lib/search-index.js";

const householdParamsSchema = z.object({
  householdId: z.string().cuid()
});

const inventoryItemParamsSchema = householdParamsSchema.extend({
  inventoryItemId: z.string().cuid()
});

const listInventoryQuerySchema = z.object({
  category: z.string().min(1).max(120).optional(),
  search: z.string().min(1).max(200).optional(),
  lowStock: z.coerce.boolean().optional(),
  itemType: z.enum(["consumable", "equipment"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().cuid().optional()
});

const inventoryDetailQuerySchema = z.object({
  transactionLimit: z.coerce.number().int().min(1).max(100).default(20)
});

const bulkInventoryReadinessQuerySchema = z.object({
  scheduleIds: z.string().optional()
});

const inventoryExportColumns = [
  "name",
  "itemType",
  "partNumber",
  "description",
  "category",
  "manufacturer",
  "quantityOnHand",
  "unit",
  "reorderThreshold",
  "reorderQuantity",
  "preferredSupplier",
  "supplierUrl",
  "unitCost",
  "storageLocation",
  "conditionStatus",
  "notes"
] as const;

const importInventoryItemSchema = z.object({
  name: z.string().min(1).max(200),
  itemType: inventoryItemTypeSchema.optional().default("consumable"),
  partNumber: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  quantityOnHand: z.coerce.number().default(0),
  unit: z.string().min(1).max(60).optional().default("each"),
  reorderThreshold: z.coerce.number().min(0).optional(),
  reorderQuantity: z.coerce.number().min(0).optional(),
  preferredSupplier: z.string().max(200).optional(),
  supplierUrl: z.string().max(1000).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  storageLocation: z.string().max(200).optional(),
  conditionStatus: z.string().max(40).optional(),
  notes: z.string().max(4000).optional()
});

const importInventorySchema = z.object({
  items: z.array(importInventoryItemSchema).min(1).max(500)
});

const importInventoryResultSchema = z.object({
  created: z.number(),
  skipped: z.number(),
  errors: z.array(z.object({
    index: z.number(),
    message: z.string()
  })),
  createdItems: z.array(inventoryItemSummarySchema)
});

const csvEscape = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const csvValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return csvEscape(String(value));
};

type InventoryRevisionValue = string | number | boolean | null;

type InventoryRevisionChange = {
  field: string;
  label: string;
  previousValue: InventoryRevisionValue;
  nextValue: InventoryRevisionValue;
};

type InventoryMetadataSnapshot = {
  name: string;
  itemType: string;
  conditionStatus: string | null;
  partNumber: string | null;
  description: string | null;
  category: string | null;
  manufacturer: string | null;
  unit: string;
  reorderThreshold: number | null;
  reorderQuantity: number | null;
  preferredSupplier: string | null;
  supplierUrl: string | null;
  storageLocation: string | null;
  notes: string | null;
  unitCost: number | null;
};

const metadataValue = (value: string | number | null | undefined): string | number | null => value ?? null;

const inventoryRevisionFields: Array<{
  field: keyof InventoryMetadataSnapshot;
  label: string;
}> = [
  { field: "name", label: "Name" },
  { field: "itemType", label: "Item Type" },
  { field: "conditionStatus", label: "Condition" },
  { field: "partNumber", label: "Part Number" },
  { field: "description", label: "Description" },
  { field: "category", label: "Category" },
  { field: "manufacturer", label: "Manufacturer" },
  { field: "unit", label: "Unit" },
  { field: "reorderThreshold", label: "Reorder Threshold" },
  { field: "reorderQuantity", label: "Reorder Quantity" },
  { field: "preferredSupplier", label: "Preferred Supplier" },
  { field: "supplierUrl", label: "Supplier Link" },
  { field: "storageLocation", label: "Storage Location" },
  { field: "notes", label: "Notes" },
  { field: "unitCost", label: "Last Price" }
];

const buildInventoryRevisionChanges = (
  existing: InventoryMetadataSnapshot,
  input: z.infer<typeof updateInventoryItemSchema>
): InventoryRevisionChange[] => inventoryRevisionFields.reduce<InventoryRevisionChange[]>((changes, descriptor) => {
  const nextRawValue = input[descriptor.field];

  if (nextRawValue === undefined) {
    return changes;
  }

  const previousValue = metadataValue(existing[descriptor.field]);
  const nextValue = metadataValue(nextRawValue as string | number | null | undefined);

  if (Object.is(previousValue, nextValue)) {
    return changes;
  }

  changes.push({
    field: descriptor.field,
    label: descriptor.label,
    previousValue,
    nextValue
  });

  return changes;
}, []);

export const householdInventoryItemRoutes: FastifyPluginAsync = async (app) => {
  const lowStockWhere = {
    reorderThreshold: { not: null },
    quantityOnHand: { lte: app.prisma.inventoryItem.fields.reorderThreshold }
  } satisfies Prisma.InventoryItemWhereInput;

  app.post("/v1/households/:householdId/inventory", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createInventoryItemSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          householdId: params.householdId,
          itemType: input.itemType ?? "consumable",
          conditionStatus: input.conditionStatus ?? null,
          name: input.name,
          partNumber: input.partNumber ?? null,
          description: input.description ?? null,
          category: input.category ?? null,
          manufacturer: input.manufacturer ?? null,
          quantityOnHand: 0,
          unit: input.unit,
          reorderThreshold: input.reorderThreshold ?? null,
          reorderQuantity: input.reorderQuantity ?? null,
          preferredSupplier: input.preferredSupplier ?? null,
          supplierUrl: input.supplierUrl ?? null,
          unitCost: input.unitCost ?? null,
          storageLocation: input.storageLocation ?? null,
          notes: input.notes ?? null
        }
      });

      if (input.quantityOnHand > 0) {
        const result = await applyInventoryTransaction(tx, {
          inventoryItemId: created.id,
          userId: request.auth.userId,
          input: {
            type: "adjust",
            quantity: input.quantityOnHand,
            unitCost: input.unitCost,
            referenceType: "manual",
            referenceId: created.id,
            notes: "Initial inventory quantity"
          }
        });

        return result.item;
      }

      return created;
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "inventory_item.created",
      entityType: "inventory_item",
      entityId: item.id,
      metadata: {
        name: item.name,
        itemType: item.itemType
      }
    });

    await emitDomainEvent(app.prisma, {
      householdId: params.householdId,
      eventType: "inventory_item.created",
      entityType: "inventory_item",
      entityId: item.id,
      payload: {
        name: item.name,
        itemType: item.itemType
      }
    });

    void syncInventoryItemToSearchIndex(app.prisma, item.id).catch(console.error);

    return reply.code(201).send(toInventoryItemSummaryResponse(item));
  });

  app.get("/v1/households/:householdId/inventory/export", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const items = await app.prisma.inventoryItem.findMany({
      where: {
        householdId: params.householdId,
        deletedAt: null
      },
      orderBy: [
        { category: "asc" },
        { name: "asc" }
      ]
    });

    const csvString = [
      inventoryExportColumns.join(","),
      ...items.map((item) => inventoryExportColumns.map((column) => csvValue(item[column])).join(","))
    ].join("\n");

    return reply
      .type("text/csv")
      .header("Content-Disposition", 'attachment; filename="inventory-export.csv"')
      .send(csvString);
  });

  app.get("/v1/households/:householdId/inventory/readiness", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = bulkInventoryReadinessQuerySchema.parse(request.query);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const scheduleIds = query.scheduleIds
      ? z.array(z.string().cuid()).parse(
          query.scheduleIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        )
      : await (async () => {
          const now = new Date();
          const upcomingCutoff = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
          const schedules = await app.prisma.maintenanceSchedule.findMany({
            where: {
              isActive: true,
              asset: {
                householdId: params.householdId,
                isArchived: false
              }
            },
            include: {
              metric: {
                select: {
                  currentValue: true
                }
              }
            }
          });

          return schedules
            .map((schedule) => ({
              id: schedule.id,
              response: toMaintenanceScheduleResponse(schedule)
            }))
            .filter(({ response }) => (
              response.status === "due"
              || response.status === "overdue"
              || (response.nextDueAt !== null && response.nextDueAt <= upcomingCutoff.toISOString())
            ))
            .map((schedule) => schedule.id);
        })();

    const readinessMap = await computeBulkSchedulePartsReadiness(app.prisma, scheduleIds);
    const schedules = scheduleIds
      .map((scheduleId) => readinessMap.get(scheduleId))
      .filter((schedule): schedule is NonNullable<typeof schedule> => schedule !== undefined);
    const allReadyCount = schedules.filter((schedule) => schedule.allReady).length;

    return bulkPartsReadinessSchema.parse({
      schedules,
      summary: {
        totalSchedules: schedules.length,
        allReadyCount,
        notReadyCount: schedules.length - allReadyCount
      }
    });
  });

  app.post("/v1/households/:householdId/inventory/import", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = importInventorySchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const createdItems: Array<Awaited<ReturnType<typeof tx.inventoryItem.create>>> = [];
      const errors: Array<{ index: number; message: string }> = [];
      let skipped = 0;

      for (const [index, item] of input.items.entries()) {
        try {
          const duplicate = await tx.inventoryItem.findFirst({
            where: {
              householdId: params.householdId,
              deletedAt: null,
              name: {
                equals: item.name,
                mode: "insensitive"
              }
            }
          });

          if (duplicate) {
            skipped += 1;
            continue;
          }

          const createdItem = await tx.inventoryItem.create({
            data: {
              householdId: params.householdId,
              name: item.name,
              itemType: item.itemType,
              partNumber: item.partNumber ?? null,
              description: item.description ?? null,
              category: item.category ?? null,
              manufacturer: item.manufacturer ?? null,
              quantityOnHand: item.quantityOnHand,
              unit: item.unit,
              reorderThreshold: item.reorderThreshold ?? null,
              reorderQuantity: item.reorderQuantity ?? null,
              preferredSupplier: item.preferredSupplier ?? null,
              supplierUrl: item.supplierUrl ?? null,
              unitCost: item.unitCost ?? null,
              storageLocation: item.storageLocation ?? null,
              conditionStatus: item.conditionStatus ?? null,
              notes: item.notes ?? null
            }
          });

          createdItems.push(createdItem);
        } catch (error) {
          errors.push({
            index,
            message: error instanceof Error ? error.message : "Failed to import item."
          });
        }
      }

      return {
        createdItems,
        skipped,
        errors
      };
    });

    await Promise.all(result.createdItems.map((item) => syncInventoryItemToSearchIndex(app.prisma, item.id)));

    return reply.code(200).send(importInventoryResultSchema.parse({
      created: result.createdItems.length,
      skipped: result.skipped,
      errors: result.errors,
      createdItems: result.createdItems.map(toInventoryItemSummaryResponse)
    }));
  });

  app.get("/v1/households/:householdId/inventory", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const query = listInventoryQuerySchema.parse(request.query);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const where: Prisma.InventoryItemWhereInput = {
      householdId: params.householdId,
      deletedAt: null,
      ...(query.lowStock ? lowStockWhere : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.itemType ? { itemType: query.itemType } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { partNumber: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };

    const items = await app.prisma.inventoryItem.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor ? {
        cursor: { id: query.cursor },
        skip: 1
      } : {}),
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    const page = items.slice(0, query.limit);
    const nextCursor = items.length > query.limit ? items[query.limit]?.id ?? null : null;

    return {
      items: page.map(toInventoryItemSummaryResponse),
      nextCursor
    };
  });

  app.get("/v1/households/:householdId/inventory/low-stock", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const items = await app.prisma.inventoryItem.findMany({
      where: {
        householdId: params.householdId,
        deletedAt: null,
        itemType: "consumable",
        ...lowStockWhere
      },
      orderBy: { createdAt: "desc" }
    });

    // This shopping-list endpoint should eventually feed inventory alert scanning once notifications support inventory events.
    return items
      .sort((left, right) => calculateInventoryDeficit(right.quantityOnHand, right.reorderThreshold) - calculateInventoryDeficit(left.quantityOnHand, left.reorderThreshold))
      .map(toLowStockInventoryItemResponse);
  });

  app.get("/v1/households/:householdId/inventory/:inventoryItemId", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);
    const query = inventoryDetailQuerySchema.parse(request.query);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const item = await app.prisma.inventoryItem.findFirst({
      where: {
        id: params.inventoryItemId,
        householdId: params.householdId,
        deletedAt: null
      },
      include: {
        transactions: {
          include: {
            correctionOfTransaction: {
              select: {
                id: true,
                type: true,
                quantity: true,
                createdAt: true
              }
            },
            correctedByTransactions: {
              select: {
                id: true,
                type: true,
                quantity: true,
                createdAt: true
              },
              orderBy: [
                { createdAt: "asc" },
                { id: "asc" }
              ]
            }
          },
          orderBy: { createdAt: "desc" },
          take: query.transactionLimit
        },
        assetLinks: {
          include: {
            asset: {
              select: { id: true, name: true, category: true }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        hobbyLinks: {
          include: {
            hobby: {
              select: { id: true, name: true, hobbyType: true, status: true }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        spaceLinks: {
          include: {
            space: {
              select: {
                id: true,
                householdId: true,
                shortCode: true,
                scanTag: true,
                name: true,
                type: true,
                parentSpaceId: true,
                description: true,
                notes: true,
                sortOrder: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true
              }
            }
          },
          where: {
            space: {
              deletedAt: null
            }
          },
          orderBy: { createdAt: "desc" }
        },
        projectLinks: {
          include: {
            project: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        revisions: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true
              }
            }
          },
          orderBy: [
            { createdAt: "desc" },
            { id: "desc" }
          ],
          take: 25
        }
      }
    });

    if (!item) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const spaceBreadcrumbs = await Promise.all(item.spaceLinks.map((link) => getSpaceBreadcrumb(app.prisma, link.space.id)));

    item.spaceLinks = item.spaceLinks.map((link, index) => ({
      ...link,
      space: {
        ...link.space,
        breadcrumb: spaceBreadcrumbs[index]
      }
    }));

    return toInventoryItemDetailResponse(item);
  });

  app.patch("/v1/households/:householdId/inventory/:inventoryItemId", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);
    const input = updateInventoryItemSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!existing) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const metadataChanges = buildInventoryRevisionChanges(existing, input);
    const item = await app.prisma.$transaction(async (tx) => {
      const quantityChanged = input.quantityOnHand !== undefined && input.quantityOnHand !== existing.quantityOnHand;

      const updated = await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
          ...(input.conditionStatus !== undefined ? { conditionStatus: input.conditionStatus ?? null } : {}),
          ...(input.partNumber !== undefined ? { partNumber: input.partNumber ?? null } : {}),
          ...(input.description !== undefined ? { description: input.description ?? null } : {}),
          ...(input.category !== undefined ? { category: input.category ?? null } : {}),
          ...(input.manufacturer !== undefined ? { manufacturer: input.manufacturer ?? null } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.reorderThreshold !== undefined ? { reorderThreshold: input.reorderThreshold ?? null } : {}),
          ...(input.reorderQuantity !== undefined ? { reorderQuantity: input.reorderQuantity ?? null } : {}),
          ...(input.preferredSupplier !== undefined ? { preferredSupplier: input.preferredSupplier ?? null } : {}),
          ...(input.supplierUrl !== undefined ? { supplierUrl: input.supplierUrl ?? null } : {}),
          ...(input.storageLocation !== undefined ? { storageLocation: input.storageLocation ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          ...(input.unitCost !== undefined ? { unitCost: input.unitCost ?? null } : {})
        }
      });

      if (metadataChanges.length > 0) {
        await tx.inventoryItemRevision.create({
          data: {
            inventoryItemId: existing.id,
            householdId: params.householdId,
            userId: request.auth.userId,
            action: "updated",
            changes: metadataChanges as Prisma.InputJsonValue
          }
        });
      }

      if (!quantityChanged) {
        return updated;
      }

      const result = await applyInventoryTransaction(tx, {
        inventoryItemId: existing.id,
        userId: request.auth.userId,
        input: {
          type: "adjust",
          quantity: (input.quantityOnHand ?? existing.quantityOnHand) - existing.quantityOnHand,
          unitCost: input.unitCost,
          referenceType: "manual",
          referenceId: existing.id,
          notes: "Direct quantity adjustment"
        },
        preventNegative: false,
        clampToZero: false
      });

      return result.item;
    });

    if (metadataChanges.length > 0 || input.quantityOnHand !== undefined) {
      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "inventory_item.updated",
        entityType: "inventory_item",
        entityId: item.id,
        metadata: {
          name: item.name,
          quantityAdjusted: input.quantityOnHand !== undefined,
          metadataChanges
        }
      });

      await emitDomainEvent(app.prisma, {
        householdId: params.householdId,
        eventType: "inventory_item.updated",
        entityType: "inventory_item",
        entityId: item.id,
        payload: {
          name: item.name,
          quantityAdjusted: input.quantityOnHand !== undefined,
          metadataChanges
        }
      });
    }

    void syncInventoryItemToSearchIndex(app.prisma, item.id).catch(console.error);

    return toInventoryItemSummaryResponse(item);
  });

  app.post("/v1/households/:householdId/inventory/:inventoryItemId/restore", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await app.prisma.inventoryItem.findFirst({
      where: {
        id: params.inventoryItemId,
        householdId: params.householdId
      }
    });

    if (!existing) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    const restored = await app.prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { deletedAt: null }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "inventory_item.restored",
      entityType: "inventory_item",
      entityId: restored.id,
      metadata: {
        name: restored.name
      }
    });

    await emitDomainEvent(app.prisma, {
      householdId: params.householdId,
      eventType: "inventory_item.restored",
      entityType: "inventory_item",
      entityId: restored.id,
      payload: {
        name: restored.name
      }
    });

    void syncInventoryItemToSearchIndex(app.prisma, restored.id).catch(console.error);

    return reply.send(toInventoryItemSummaryResponse(restored));
  });

  app.post("/v1/households/:householdId/inventory/:inventoryItemId/merge", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);
    const input = mergeInventoryItemsSchema.parse(request.body);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    try {
      const result = await app.prisma.$transaction((tx) => mergeHouseholdInventoryItems(tx, {
        householdId: params.householdId,
        targetInventoryItemId: params.inventoryItemId,
        sourceInventoryItemId: input.sourceInventoryItemId
      }));

      await emitDomainEvent(app.prisma, {
        householdId: params.householdId,
        eventType: "inventory_item.merged",
        entityType: "inventory_item",
        entityId: params.inventoryItemId,
        payload: {
          sourceInventoryItemId: input.sourceInventoryItemId,
          targetInventoryItemId: params.inventoryItemId
        }
      });

      await logActivity(app.prisma, {
        householdId: params.householdId,
        userId: request.auth.userId,
        action: "inventory_item.merged",
        entityType: "inventory_item",
        entityId: params.inventoryItemId,
        metadata: {
          sourceInventoryItemId: input.sourceInventoryItemId,
          targetInventoryItemId: params.inventoryItemId
        }
      });

      void removeSearchIndexEntry(app.prisma, "inventory_item", input.sourceInventoryItemId).catch(console.error);
      void syncInventoryItemToSearchIndex(app.prisma, params.inventoryItemId).catch(console.error);

      return reply.send(inventoryItemMergeResultSchema.parse(result));
    } catch (error) {
      if (error instanceof InventoryError) {
        const statusCode = error.code === "INVENTORY_ITEM_NOT_FOUND"
          ? 404
          : 400;
        return reply.code(statusCode).send({ message: error.message });
      }

      throw error;
    }
  });

  app.delete("/v1/households/:householdId/inventory/:inventoryItemId", async (request, reply) => {
    const params = inventoryItemParamsSchema.parse(request.params);

    if (!await checkMembership(app.prisma, params.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const existing = await getHouseholdInventoryItem(app.prisma, params.householdId, params.inventoryItemId);

    if (!existing) {
      return reply.code(404).send({ message: "Inventory item not found." });
    }

    await app.prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });

    await logActivity(app.prisma, {
      householdId: params.householdId,
      userId: request.auth.userId,
      action: "inventory_item.deleted",
      entityType: "inventory_item",
      entityId: existing.id,
      metadata: {
        name: existing.name
      }
    });

    await emitDomainEvent(app.prisma, {
      householdId: params.householdId,
      eventType: "inventory_item.deleted",
      entityType: "inventory_item",
      entityId: existing.id,
      payload: {
        name: existing.name
      }
    });

    void removeSearchIndexEntry(app.prisma, "inventory_item", existing.id).catch(console.error);

    return reply.code(204).send();
  });
};
