import type { CanvasObject as PrismaCanvasObject } from "@prisma/client";
import { canvasObjectSchema } from "@aegis/types";

export const toCanvasObjectResponse = (obj: PrismaCanvasObject) =>
  canvasObjectSchema.parse({
    id: obj.id,
    householdId: obj.householdId,
    name: obj.name,
    category: obj.category,
    imageSource: obj.imageSource,
    presetKey: obj.presetKey ?? null,
    attachmentId: obj.attachmentId ?? null,
    maskData: obj.maskData ?? null,
    deletedAt: obj.deletedAt?.toISOString() ?? null,
    createdAt: obj.createdAt.toISOString(),
    updatedAt: obj.updatedAt.toISOString(),
  });
