import {
  createHobbyLogInputSchema,
  updateHobbyLogInputSchema
} from "@lifekeeper/types";
import {
  HOBBY_LOG_TYPE_PREFIX,
  buildHobbyLogEntryTags,
  mapHobbyLogTypeToEntryType
} from "@lifekeeper/utils";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireHouseholdMembership } from "../../lib/asset-access.js";
import { createActivityLogger } from "../../lib/activity-log.js";
import { toInputJsonValue, parseTags } from "../../lib/prisma-json.js";
import { toEntryAsHobbyLog } from "../../lib/serializers/index.js";
import { removeSearchIndexEntry, syncEntryToSearchIndex } from "../../lib/search-index.js";
import { notFound, badRequest } from "../../lib/errors.js";
import { hobbyParamsSchema } from "../../lib/schemas.js";

const logParamsSchema = hobbyParamsSchema.extend({
  logId: z.string().cuid()
});

const listLogsQuerySchema = z.object({
  sessionId: z.string().cuid().optional(),
  logType: z.string().optional()
});

const getHobby = (
  app: { prisma: { hobby: { findFirst: Function } } },
  householdId: string,
  hobbyId: string
) => app.prisma.hobby.findFirst({
  where: { id: hobbyId, householdId },
  select: { id: true, householdId: true, name: true }
});

export const hobbyLogRoutes: FastifyPluginAsync = async (app) => {
  // GET /v1/households/:householdId/hobbies/:hobbyId/logs
  app.get("/v1/households/:householdId/hobbies/:hobbyId/logs", async (request, reply) => {
    const params = hobbyParamsSchema.parse(request.params);
    const query = listLogsQuerySchema.parse(request.query);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await getHobby(app, params.householdId, params.hobbyId);

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    let entityFilter: object;

    if (query.sessionId) {
      entityFilter = { entityType: "hobby_session" as const, entityId: query.sessionId };
    } else {
      const sessions = await app.prisma.hobbySession.findMany({
        where: { hobbyId: hobby.id },
        select: { id: true }
      });
      const sessionIds = sessions.map((s) => s.id);
      entityFilter = {
        OR: [
          { entityType: "hobby" as const, entityId: hobby.id },
          ...(sessionIds.length > 0 ? [{ entityType: "hobby_session" as const, entityId: { in: sessionIds } }] : [])
        ]
      };
    }

    const logTypeFilter = query.logType
      ? { tags: { array_contains: [`${HOBBY_LOG_TYPE_PREFIX}${query.logType}`] } }
      : {};

    const entries = await app.prisma.entry.findMany({
      where: {
        householdId: params.householdId,
        ...entityFilter,
        ...logTypeFilter
      },
      orderBy: { entryDate: "desc" }
    });

    return entries.map((entry) => toEntryAsHobbyLog(entry, hobby.id));
  });

  // GET /v1/households/:householdId/hobbies/:hobbyId/logs/:logId
  app.get("/v1/households/:householdId/hobbies/:hobbyId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await getHobby(app, params.householdId, params.hobbyId);

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const sessions = await app.prisma.hobbySession.findMany({
      where: { hobbyId: hobby.id },
      select: { id: true }
    });
    const sessionIds = sessions.map((s) => s.id);

    const entry = await app.prisma.entry.findFirst({
      where: {
        id: params.logId,
        householdId: params.householdId,
        OR: [
          { entityType: "hobby" as const, entityId: hobby.id },
          ...(sessionIds.length > 0 ? [{ entityType: "hobby_session" as const, entityId: { in: sessionIds } }] : [])
        ]
      }
    });

    if (!entry) {
      return notFound(reply, "Hobby log");
    }

    return toEntryAsHobbyLog(entry, hobby.id);
  });

  // POST /v1/households/:householdId/hobbies/:hobbyId/logs
  app.post("/v1/households/:householdId/hobbies/:hobbyId/logs", async (request, reply) => {
    const params = hobbyParamsSchema.parse(request.params);
    const input = createHobbyLogInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await getHobby(app, params.householdId, params.hobbyId);

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    if (input.sessionId) {
      const session = await app.prisma.hobbySession.findFirst({
        where: { id: input.sessionId, hobbyId: hobby.id },
        select: { id: true }
      });

      if (!session) {
        return badRequest(reply, "Session not found in this hobby.");
      }
    }

    const logType = input.logType ?? "note";
    const tags = buildHobbyLogEntryTags(logType);
    const entryType = mapHobbyLogTypeToEntryType(logType);

    const entry = await app.prisma.entry.create({
      data: {
        householdId: params.householdId,
        createdById: request.auth.userId,
        title: input.title ?? null,
        body: input.content,
        entryDate: new Date(input.logDate),
        entityType: input.sessionId ? "hobby_session" : "hobby",
        entityId: input.sessionId ?? hobby.id,
        entryType,
        tags: toInputJsonValue(tags)
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("hobby_log", entry.id, "hobby.log.created", params.householdId, { hobbyId: hobby.id, logType });

    void syncEntryToSearchIndex(app.prisma, entry.id).catch(console.error);

    return reply.code(201).send(toEntryAsHobbyLog(entry, hobby.id));
  });

  // PATCH /v1/households/:householdId/hobbies/:hobbyId/logs/:logId
  app.patch("/v1/households/:householdId/hobbies/:hobbyId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);
    const input = updateHobbyLogInputSchema.parse(request.body);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await getHobby(app, params.householdId, params.hobbyId);

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const sessions = await app.prisma.hobbySession.findMany({
      where: { hobbyId: hobby.id },
      select: { id: true }
    });
    const sessionIds = sessions.map((s) => s.id);

    const existing = await app.prisma.entry.findFirst({
      where: {
        id: params.logId,
        householdId: params.householdId,
        OR: [
          { entityType: "hobby" as const, entityId: hobby.id },
          ...(sessionIds.length > 0 ? [{ entityType: "hobby_session" as const, entityId: { in: sessionIds } }] : [])
        ]
      }
    });

    if (!existing) {
      return notFound(reply, "Hobby log");
    }

    // Validate new session if given
    if (input.sessionId !== undefined && input.sessionId !== null) {
      const session = await app.prisma.hobbySession.findFirst({
        where: { id: input.sessionId, hobbyId: hobby.id },
        select: { id: true }
      });

      if (!session) {
        return badRequest(reply, "Session not found in this hobby.");
      }
    }

    // Parse current logType from existing entry
    const currentTags = parseTags(existing.tags);
    const currentLogTypeTag = currentTags.find((t) => t.startsWith(HOBBY_LOG_TYPE_PREFIX));
    const currentLogType = currentLogTypeTag
      ? currentLogTypeTag.slice(HOBBY_LOG_TYPE_PREFIX.length)
      : existing.entryType === "lesson" ? "lesson" : existing.entryType === "milestone" ? "milestone" : "note";

    const logType = input.logType ?? currentLogType;
    const tags = buildHobbyLogEntryTags(logType);
    const entryType = mapHobbyLogTypeToEntryType(logType);

    // Determine entity assignment
    let entityType: "hobby" | "hobby_session" = existing.entityType as "hobby" | "hobby_session";
    let entityId = existing.entityId;

    if (input.sessionId !== undefined) {
      if (input.sessionId === null) {
        entityType = "hobby";
        entityId = hobby.id;
      } else {
        entityType = "hobby_session";
        entityId = input.sessionId;
      }
    }

    const updated = await app.prisma.entry.update({
      where: { id: existing.id },
      data: {
        title: input.title !== undefined ? (input.title ?? null) : existing.title,
        body: input.content !== undefined ? input.content : existing.body,
        entryDate: input.logDate !== undefined ? new Date(input.logDate) : existing.entryDate,
        entityType,
        entityId,
        entryType,
        tags: toInputJsonValue(tags)
      }
    });

        await createActivityLogger(app.prisma, request.auth.userId).log("hobby_log", updated.id, "hobby.log.updated", params.householdId, { hobbyId: hobby.id });

    return toEntryAsHobbyLog(updated, hobby.id);
  });

  // DELETE /v1/households/:householdId/hobbies/:hobbyId/logs/:logId
  app.delete("/v1/households/:householdId/hobbies/:hobbyId/logs/:logId", async (request, reply) => {
    const params = logParamsSchema.parse(request.params);

    if (!await requireHouseholdMembership(app.prisma, params.householdId, request.auth.userId, reply)) {
      return;
    }

    const hobby = await getHobby(app, params.householdId, params.hobbyId);

    if (!hobby) {
      return notFound(reply, "Hobby");
    }

    const sessions = await app.prisma.hobbySession.findMany({
      where: { hobbyId: hobby.id },
      select: { id: true }
    });
    const sessionIds = sessions.map((s) => s.id);

    const existing = await app.prisma.entry.findFirst({
      where: {
        id: params.logId,
        householdId: params.householdId,
        OR: [
          { entityType: "hobby" as const, entityId: hobby.id },
          ...(sessionIds.length > 0 ? [{ entityType: "hobby_session" as const, entityId: { in: sessionIds } }] : [])
        ]
      },
      select: { id: true }
    });

    if (!existing) {
      return notFound(reply, "Hobby log");
    }

    await app.prisma.entry.delete({ where: { id: existing.id } });

        await createActivityLogger(app.prisma, request.auth.userId).log("hobby_log", existing.id, "hobby.log.deleted", params.householdId, { hobbyId: hobby.id });

    await removeSearchIndexEntry(app.prisma, "entry", existing.id);

    return reply.code(204).send();
  });
};
