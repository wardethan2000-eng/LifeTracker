import type { Prisma } from "@prisma/client";
import { presetLibrary } from "@aegis/presets";
import {
  applyPresetSchema,
  createPresetProfileSchema,
  updatePresetProfileSchema
} from "@aegis/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, getAccessibleAsset } from "../../lib/asset-access.js";
import {
  applyPresetToAsset,
  getLibraryPresetByKey,
  slugifyPresetKey,
  toCustomPresetProfileResponse
} from "../../lib/presets.js";
import { toInputJsonValue } from "../../lib/prisma-json.js";
import { forbidden, notFound } from "../../lib/errors.js";
import { assetParamsSchema, householdParamsSchema } from "../../lib/schemas.js";

const presetProfileParamsSchema = householdParamsSchema.extend({
  presetProfileId: z.string().cuid()
});

const libraryPresetParamsSchema = z.object({
  presetKey: z.string().min(1)
});

export const presetRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/presets/library", async () => presetLibrary);

  app.get("/v1/presets/library/:presetKey", async (request, reply) => {
    const params = libraryPresetParamsSchema.parse(request.params);
    const preset = getLibraryPresetByKey(params.presetKey);

    if (!preset) {
      return notFound(reply, "Preset");
    }

    return preset;
  });

  app.get("/v1/households/:householdId/presets", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const presets = await app.prisma.presetProfile.findMany({
      where: { householdId: params.householdId },
      orderBy: { name: "asc" }
    });

    return presets.map(toCustomPresetProfileResponse);
  });

  app.post("/v1/households/:householdId/presets", async (request, reply) => {
    const params = householdParamsSchema.parse(request.params);
    const input = createPresetProfileSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const key = slugifyPresetKey(input.key ?? input.label);

    const data: Prisma.PresetProfileUncheckedCreateInput = {
      householdId: params.householdId,
      createdById: request.auth.userId,
      key,
      name: input.label,
      category: input.category,
      tags: input.tags,
      customFieldTemplates: toInputJsonValue(input.suggestedCustomFields),
      metricTemplates: toInputJsonValue(input.metricTemplates),
      scheduleTemplates: toInputJsonValue(input.scheduleTemplates)
    };

    if (input.description !== undefined) {
      data.description = input.description;
    }

    const preset = await app.prisma.presetProfile.create({ data });

    return reply.code(201).send(toCustomPresetProfileResponse(preset));
  });

  app.get("/v1/households/:householdId/presets/:presetProfileId", async (request, reply) => {
    const params = presetProfileParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const preset = await app.prisma.presetProfile.findFirst({
      where: {
        id: params.presetProfileId,
        householdId: params.householdId
      }
    });

    if (!preset) {
      return notFound(reply, "Preset profile");
    }

    return toCustomPresetProfileResponse(preset);
  });

  app.patch("/v1/households/:householdId/presets/:presetProfileId", async (request, reply) => {
    const params = presetProfileParamsSchema.parse(request.params);
    const input = updatePresetProfileSchema.parse(request.body);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const existing = await app.prisma.presetProfile.findFirst({
      where: {
        id: params.presetProfileId,
        householdId: params.householdId
      }
    });

    if (!existing) {
      return notFound(reply, "Preset profile");
    }

    const data: Prisma.PresetProfileUncheckedUpdateInput = {};

    if (input.key !== undefined) {
      data.key = slugifyPresetKey(input.key);
    }

    if (input.label !== undefined) {
      data.name = input.label;
    }

    if (input.category !== undefined) {
      data.category = input.category;
    }

    if (input.description !== undefined) {
      data.description = input.description;
    }

    if (input.tags !== undefined) {
      data.tags = input.tags;
    }

    if (input.suggestedCustomFields !== undefined) {
      data.customFieldTemplates = toInputJsonValue(input.suggestedCustomFields);
    }

    if (input.metricTemplates !== undefined) {
      data.metricTemplates = toInputJsonValue(input.metricTemplates);
    }

    if (input.scheduleTemplates !== undefined) {
      data.scheduleTemplates = toInputJsonValue(input.scheduleTemplates);
    }

    const preset = await app.prisma.presetProfile.update({
      where: { id: existing.id },
      data
    });

    return toCustomPresetProfileResponse(preset);
  });

  app.delete("/v1/households/:householdId/presets/:presetProfileId", async (request, reply) => {
    const params = presetProfileParamsSchema.parse(request.params);

    try {
      await assertMembership(app.prisma, params.householdId, request.auth.userId);
    } catch {
      return forbidden(reply);
    }

    const existing = await app.prisma.presetProfile.findFirst({
      where: {
        id: params.presetProfileId,
        householdId: params.householdId
      }
    });

    if (!existing) {
      return notFound(reply, "Preset profile");
    }

    await app.prisma.presetProfile.delete({ where: { id: existing.id } });

    return reply.code(204).send();
  });

  app.post("/v1/assets/:assetId/apply-preset", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const input = applyPresetSchema.parse(request.body);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return notFound(reply, "Asset");
    }

    let preset;
    let sourceLabel;

    if (input.source === "library") {
      preset = getLibraryPresetByKey(input.presetKey!);
      sourceLabel = `library:${input.presetKey}`;
    } else {
      const presetProfileId = input.presetProfileId!;
      const customPreset = await app.prisma.presetProfile.findFirst({
        where: {
          id: presetProfileId,
          householdId: asset.householdId
        }
      });

      if (!customPreset) {
        return notFound(reply, "Preset profile");
      }

      preset = toCustomPresetProfileResponse(customPreset);
      sourceLabel = `custom:${customPreset.id}`;
    }

    if (!preset) {
      return notFound(reply, "Preset");
    }

    try {
      const result = await app.prisma.$transaction(async (tx) => applyPresetToAsset(tx, asset, preset, {
        mergeCustomFields: input.mergeCustomFields,
        skipExistingMetrics: input.skipExistingMetrics,
        skipExistingSchedules: input.skipExistingSchedules,
        sourceLabel
      }));

      return reply.code(201).send({
        preset,
        result
      });
    } catch (error) {
      return reply.code(400).send({
        message: error instanceof Error ? error.message : "Failed to apply preset."
      });
    }
  });
};
