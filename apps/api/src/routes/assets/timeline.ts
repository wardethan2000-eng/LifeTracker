import { assetTimelineQuerySchema, conditionEntrySchema } from "@lifekeeper/types";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { assertMembership, getAccessibleAsset } from "../../lib/asset-access.js";
import { toTimelineItem } from "../../lib/serializers/index.js";

const assetParamsSchema = z.object({
  assetId: z.string().cuid()
});

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const includesSource = (selected: string | undefined, candidate: string): boolean => !selected || selected === candidate;

const containsSearchText = (haystack: string | null | undefined, needle: string): boolean => {
  if (!haystack) {
    return false;
  }

  return haystack.toLowerCase().includes(needle);
};

const matchesDateRange = (isoDate: string, since?: string, until?: string): boolean => {
  const value = new Date(isoDate).getTime();

  if (since && value < new Date(since).getTime()) {
    return false;
  }

  if (until && value > new Date(until).getTime()) {
    return false;
  }

  return true;
};

export const timelineRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/assets/:assetId/timeline", async (request, reply) => {
    const params = assetParamsSchema.parse(request.params);
    const query = assetTimelineQuerySchema.parse(request.query);
    const asset = await getAccessibleAsset(app.prisma, params.assetId, request.auth.userId);

    if (!asset) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    try {
      await assertMembership(app.prisma, asset.householdId, request.auth.userId);
    } catch {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const maintenanceLogsPromise = includesSource(query.sourceType, "maintenance_log")
      ? app.prisma.maintenanceLog.findMany({
          where: {
            assetId: asset.id,
            ...(query.since || query.until
              ? {
                  completedAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            parts: true,
            completedBy: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        })
      : Promise.resolve([]);

    const timelineEntriesPromise = includesSource(query.sourceType, "timeline_entry")
      ? app.prisma.assetTimelineEntry.findMany({
          where: {
            assetId: asset.id,
            ...(query.since || query.until
              ? {
                  entryDate: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            createdBy: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        })
      : Promise.resolve([]);

    const projectEventsPromise = includesSource(query.sourceType, "project_event")
      ? (async () => {
          const [taskIds, phaseIds] = await Promise.all([
            app.prisma.projectTask.findMany({
              where: {
                project: {
                  assets: {
                    some: {
                      assetId: asset.id
                    }
                  }
                }
              },
              select: { id: true }
            }),
            app.prisma.projectPhase.findMany({
              where: {
                project: {
                  assets: {
                    some: {
                      assetId: asset.id
                    }
                  }
                }
              },
              select: { id: true }
            })
          ]);

          const ids = {
            taskIds: taskIds.map((task) => task.id),
            phaseIds: phaseIds.map((phase) => phase.id)
          };

          if (ids.taskIds.length === 0 && ids.phaseIds.length === 0) {
            return [];
          }

          return app.prisma.activityLog.findMany({
            where: {
              householdId: asset.householdId,
              ...(query.since || query.until
                ? {
                    createdAt: {
                      ...(query.since ? { gte: new Date(query.since) } : {}),
                      ...(query.until ? { lte: new Date(query.until) } : {})
                    }
                  }
                : {}),
              OR: [
                ...(ids.taskIds.length > 0
                  ? [{ entityType: "project_task", entityId: { in: ids.taskIds } }]
                  : []),
                ...(ids.phaseIds.length > 0
                  ? [{ entityType: "project_phase", entityId: { in: ids.phaseIds } }]
                  : [])
              ]
            },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          });
        })()
      : Promise.resolve([]);

    const scheduleActivitiesPromise = includesSource(query.sourceType, "schedule_change")
      ? app.prisma.activityLog.findMany({
          where: {
            householdId: asset.householdId,
            entityType: "schedule",
            metadata: {
              path: ["assetId"],
              equals: asset.id
            },
            ...(query.since || query.until
              ? {
                  createdAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            user: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        })
      : Promise.resolve([]);

    const commentsPromise = includesSource(query.sourceType, "comment")
      ? app.prisma.comment.findMany({
          where: {
            assetId: asset.id,
            ...(query.since || query.until
              ? {
                  createdAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            author: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        })
      : Promise.resolve([]);

    const usageReadingsPromise = includesSource(query.sourceType, "usage_reading")
      ? app.prisma.usageMetricEntry.findMany({
          where: {
            metric: {
              assetId: asset.id
            },
            ...(query.since || query.until
              ? {
                  recordedAt: {
                    ...(query.since ? { gte: new Date(query.since) } : {}),
                    ...(query.until ? { lte: new Date(query.until) } : {})
                  }
                }
              : {})
          },
          include: {
            metric: {
              select: {
                assetId: true,
                name: true,
                unit: true
              }
            }
          }
        })
      : Promise.resolve([]);

    const [maintenanceLogs, timelineEntries, projectEvents, scheduleActivities, comments, usageReadings] = await Promise.all([
      maintenanceLogsPromise,
      timelineEntriesPromise,
      projectEventsPromise,
      scheduleActivitiesPromise,
      commentsPromise,
      usageReadingsPromise
    ]);

    const normalizedItems = [
      ...maintenanceLogs.map((log) => {
        const totalPartsCost = log.parts.reduce(
          (sum, part) => sum + part.quantity * (part.unitCost ?? 0),
          0
        );
        const totalLaborCost = typeof log.laborHours === "number" && typeof log.laborRate === "number"
          ? log.laborHours * log.laborRate
          : null;

        return toTimelineItem(
          "maintenance_log",
          {
            ...log,
            totalPartsCost,
            totalLaborCost
          },
          {
            id: log.completedBy.id,
            displayName: log.completedBy.displayName
          }
        );
      }),
      ...timelineEntries.map((entry) => toTimelineItem(
        "timeline_entry",
        entry,
        {
          id: entry.createdBy.id,
          displayName: entry.createdBy.displayName
        }
      )),
      ...projectEvents.map((activity) => toTimelineItem(
        "project_event",
        {
          ...activity,
          assetId: asset.id
        },
        {
          id: activity.user.id,
          displayName: activity.user.displayName
        }
      )),
      ...scheduleActivities
        .map((activity) => toTimelineItem(
          "schedule_change",
          {
            ...activity,
            assetId: asset.id
          },
          {
            id: activity.user.id,
            displayName: activity.user.displayName
          }
        )),
      ...comments.map((comment) => toTimelineItem(
        "comment",
        comment,
        {
          id: comment.author.id,
          displayName: comment.author.displayName
        }
      )),
      ...(includesSource(query.sourceType, "condition_assessment")
        ? (() => {
            const parsedHistory = conditionEntrySchema.array().safeParse(
              Array.isArray(asset.conditionHistory) ? asset.conditionHistory : []
            );

            if (!parsedHistory.success) {
              return [];
            }

            return parsedHistory.data
              .filter((entry) => matchesDateRange(entry.assessedAt, query.since, query.until))
              .map((entry) => toTimelineItem("condition_assessment", {
                assetId: asset.id,
                ...entry
              }));
          })()
        : []),
      ...usageReadings.map((reading) => toTimelineItem("usage_reading", reading))
    ].sort((left, right) => {
      const eventDelta = new Date(right.eventDate).getTime() - new Date(left.eventDate).getTime();

      if (eventDelta !== 0) {
        return eventDelta;
      }

      const createdDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

      if (createdDelta !== 0) {
        return createdDelta;
      }

      return right.id.localeCompare(left.id);
    });

    const totalSources = new Set(normalizedItems.map((item) => item.sourceType)).size;
    const searchNeedle = query.search?.trim().toLowerCase() ?? "";

    let filteredItems = normalizedItems;

    if (query.category) {
      const categoryNeedle = query.category.toLowerCase();
      filteredItems = filteredItems.filter((item) => (item.category ?? "").toLowerCase() === categoryNeedle);
    }

    if (searchNeedle) {
      filteredItems = filteredItems.filter((item) => (
        containsSearchText(item.title, searchNeedle)
        || containsSearchText(item.description, searchNeedle)
      ));
    }

    let cursorIndex = -1;

    if (query.cursor) {
      cursorIndex = filteredItems.findIndex((item) => item.id === query.cursor);

      if (cursorIndex === -1) {
        return reply.code(400).send({ message: "Invalid timeline cursor." });
      }
    }

    const window = filteredItems.slice(cursorIndex + 1, cursorIndex + 1 + query.limit + 1);
    const hasMore = window.length > query.limit;
    const items = hasMore ? window.slice(0, query.limit) : window;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return {
      items,
      nextCursor,
      totalSources
    };
  });
};