import { Prisma } from "@prisma/client";
import { actionableEntryGroupSchema, entryMeasurementSchema, entrySchema } from "@lifekeeper/types";
import type { EntryEntityContext } from "../entries.js";
import { toShallowUserResponse } from "./users.js";

export const entryResponseInclude = Prisma.validator<Prisma.EntryInclude>()({
  createdBy: { select: { id: true, displayName: true } },
  flags: {
    select: { flag: true },
    orderBy: [{ createdAt: "asc" }, { flag: "asc" }]
  }
});

export type EntryResponseRecord = Prisma.EntryGetPayload<{
  include: typeof entryResponseInclude;
}>;

const parseEntryMeasurements = (value: Prisma.JsonValue) => entryMeasurementSchema.array().parse(value ?? []);

const parseEntryTags = (value: Prisma.JsonValue) => entrySchema.shape.tags.parse(value ?? []);

export const toEntryResponse = (entry: EntryResponseRecord, resolvedEntity: EntryEntityContext) => entrySchema.parse({
  id: entry.id,
  householdId: entry.householdId,
  createdById: entry.createdById,
  title: entry.title ?? null,
  body: entry.body,
  entryDate: entry.entryDate.toISOString(),
  entityType: entry.entityType,
  entityId: entry.entityId,
  entryType: entry.entryType,
  measurements: parseEntryMeasurements(entry.measurements),
  tags: parseEntryTags(entry.tags),
  attachmentUrl: entry.attachmentUrl ?? null,
  attachmentName: entry.attachmentName ?? null,
  sourceType: entry.sourceType ?? null,
  sourceId: entry.sourceId ?? null,
  flags: entry.flags.map((flag) => flag.flag),
  createdBy: toShallowUserResponse(entry.createdBy),
  resolvedEntity,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString()
});

export const toActionableEntryGroupResponse = (group: {
  entityType: EntryResponseRecord["entityType"];
  items: ReturnType<typeof toEntryResponse>[];
}) => actionableEntryGroupSchema.parse(group);