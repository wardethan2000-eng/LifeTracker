import type { Prisma, PrismaClient } from "@prisma/client";
import type { EntryEntityType } from "@lifekeeper/types";

type EntryPrisma = PrismaClient | Prisma.TransactionClient;

export type EntryEntityContext = {
  entityType: EntryEntityType;
  entityId: string;
  label: string;
  parentEntityType: EntryEntityType | null;
  parentEntityId: string | null;
  parentLabel: string | null;
  entityUrl: string;
};

type EntryTargetValidationResult =
  | { status: "ok"; context: EntryEntityContext }
  | { status: "missing" }
  | { status: "unsupported"; message: string };

const unsupportedEntryTargetMessage = (entityType: EntryEntityType) => (
  `Entry entity type ${entityType} cannot be validated yet because the backing model is not implemented.`
);

export const createEntryEntityKey = (entityType: EntryEntityType, entityId: string) => `${entityType}:${entityId}`;

const buildContext = (context: EntryEntityContext): EntryEntityContext => context;

export const validateEntryTarget = async (
  prisma: EntryPrisma,
  householdId: string,
  entityType: EntryEntityType,
  entityId: string
): Promise<EntryTargetValidationResult> => {
  switch (entityType) {
    case "hobby": {
      const hobby = await prisma.hobby.findFirst({
        where: { id: entityId, householdId },
        select: { id: true, name: true }
      });

      return hobby
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: hobby.id,
              label: hobby.name,
              parentEntityType: null,
              parentEntityId: null,
              parentLabel: null,
              entityUrl: `/hobbies/${hobby.id}?householdId=${householdId}`
            })
          }
        : { status: "missing" };
    }
    case "hobby_series": {
      const series = await prisma.hobbySeries.findFirst({
        where: { id: entityId, householdId },
        select: {
          id: true,
          name: true,
          hobby: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return series
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: series.id,
              label: series.name,
              parentEntityType: "hobby",
              parentEntityId: series.hobby.id,
              parentLabel: series.hobby.name,
              entityUrl: `/hobbies/${series.hobby.id}?householdId=${householdId}&seriesId=${series.id}`
            })
          }
        : { status: "missing" };
    }
    case "hobby_session": {
      const session = await prisma.hobbySession.findFirst({
        where: {
          id: entityId,
          hobby: { householdId }
        },
        select: {
          id: true,
          name: true,
          hobby: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return session
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: session.id,
              label: session.name,
              parentEntityType: "hobby",
              parentEntityId: session.hobby.id,
              parentLabel: session.hobby.name,
              entityUrl: `/hobbies/${session.hobby.id}?householdId=${householdId}`
            })
          }
        : { status: "missing" };
    }
    case "hobby_project": {
      const project = await prisma.hobbyProject.findFirst({
        where: {
          id: entityId,
          householdId,
        },
        select: {
          id: true,
          name: true,
          hobby: { select: { id: true, name: true } },
        }
      });

      return project
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: project.id,
              label: project.name,
              parentEntityType: "hobby",
              parentEntityId: project.hobby.id,
              parentLabel: project.hobby.name,
              entityUrl: `/hobbies/${project.hobby.id}?householdId=${householdId}&projectId=${project.id}`
            })
          }
        : { status: "missing" };
    }
    case "hobby_project_milestone": {
      const milestone = await prisma.hobbyProjectMilestone.findFirst({
        where: {
          id: entityId,
          hobbyProject: { householdId },
        },
        select: {
          id: true,
          name: true,
          hobbyProject: {
            select: {
              id: true,
              name: true,
              hobby: {
                select: {
                  id: true,
                  name: true,
                }
              }
            }
          }
        }
      });

      return milestone
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: milestone.id,
              label: milestone.name,
              parentEntityType: "hobby_project",
              parentEntityId: milestone.hobbyProject.id,
              parentLabel: milestone.hobbyProject.name,
              entityUrl: `/hobbies/${milestone.hobbyProject.hobby.id}?householdId=${householdId}&projectId=${milestone.hobbyProject.id}`
            })
          }
        : { status: "missing" };
    }
    case "hobby_collection_item": {
      const item = await prisma.hobbyCollectionItem.findFirst({
        where: {
          id: entityId,
          householdId,
        },
        select: {
          id: true,
          name: true,
          hobby: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return item
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: item.id,
              label: item.name,
              parentEntityType: "hobby",
              parentEntityId: item.hobby.id,
              parentLabel: item.hobby.name,
              entityUrl: `/hobbies/${item.hobby.id}?householdId=${householdId}&collectionItemId=${item.id}`,
            }),
          }
        : { status: "missing" };
    }
    case "project": {
      const project = await prisma.project.findFirst({
        where: { id: entityId, householdId, deletedAt: null },
        select: { id: true, name: true }
      });

      return project
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: project.id,
              label: project.name,
              parentEntityType: null,
              parentEntityId: null,
              parentLabel: null,
              entityUrl: `/projects/${project.id}?householdId=${householdId}`
            })
          }
        : { status: "missing" };
    }
    case "project_phase": {
      const phase = await prisma.projectPhase.findFirst({
        where: {
          id: entityId,
          deletedAt: null,
          project: { householdId, deletedAt: null }
        },
        select: {
          id: true,
          name: true,
          project: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return phase
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: phase.id,
              label: phase.name,
              parentEntityType: "project",
              parentEntityId: phase.project.id,
              parentLabel: phase.project.name,
              entityUrl: `/projects/${phase.project.id}?householdId=${householdId}`
            })
          }
        : { status: "missing" };
    }
    case "asset": {
      const asset = await prisma.asset.findFirst({
        where: { id: entityId, householdId, deletedAt: null },
        select: { id: true, name: true }
      });

      return asset
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: asset.id,
              label: asset.name,
              parentEntityType: null,
              parentEntityId: null,
              parentLabel: null,
              entityUrl: `/assets/${asset.id}`
            })
          }
        : { status: "missing" };
    }
    case "schedule": {
      const schedule = await prisma.maintenanceSchedule.findFirst({
        where: {
          id: entityId,
          deletedAt: null,
          asset: { householdId, deletedAt: null }
        },
        select: {
          id: true,
          name: true,
          asset: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return schedule
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: schedule.id,
              label: schedule.name,
              parentEntityType: "asset",
              parentEntityId: schedule.asset.id,
              parentLabel: schedule.asset.name,
              entityUrl: `/assets/${schedule.asset.id}?tab=maintenance`
            })
          }
        : { status: "missing" };
    }
    case "maintenance_log": {
      const log = await prisma.maintenanceLog.findFirst({
        where: {
          id: entityId,
          deletedAt: null,
          asset: { householdId, deletedAt: null }
        },
        select: {
          id: true,
          title: true,
          asset: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return log
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: log.id,
              label: log.title,
              parentEntityType: "asset",
              parentEntityId: log.asset.id,
              parentLabel: log.asset.name,
              entityUrl: `/assets/${log.asset.id}?tab=maintenance`
            })
          }
        : { status: "missing" };
    }
    case "inventory_item": {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: entityId, householdId, deletedAt: null },
        select: { id: true, name: true }
      });

      return item
        ? {
            status: "ok",
            context: buildContext({
              entityType,
              entityId: item.id,
              label: item.name,
              parentEntityType: null,
              parentEntityId: null,
              parentLabel: null,
              entityUrl: `/inventory?householdId=${householdId}&highlight=${item.id}`
            })
          }
        : { status: "missing" };
    }
    case "notebook": {
      const household = await prisma.household.findFirst({
        where: { id: entityId },
        select: { id: true, name: true }
      });

      if (!household || household.id !== householdId) return { status: "missing" };

      return {
        status: "ok",
        context: buildContext({
          entityType,
          entityId: household.id,
          label: "Notebook",
          parentEntityType: null,
          parentEntityId: null,
          parentLabel: null,
          entityUrl: `/notes?householdId=${householdId}`
        })
      };
    }
    default:
      return { status: "unsupported", message: unsupportedEntryTargetMessage(entityType) };
  }
};

export const resolveEntryEntityContexts = async (
  prisma: EntryPrisma,
  householdId: string,
  entries: Array<{ entityType: EntryEntityType; entityId: string }>
): Promise<Map<string, EntryEntityContext>> => {
  const byType = new Map<EntryEntityType, Set<string>>();

  for (const entry of entries) {
    const existing = byType.get(entry.entityType) ?? new Set<string>();
    existing.add(entry.entityId);
    byType.set(entry.entityType, existing);
  }

  const resolved = new Map<string, EntryEntityContext>();

  const hobbyIds = Array.from(byType.get("hobby") ?? []);
  if (hobbyIds.length > 0) {
    const hobbies = await prisma.hobby.findMany({
      where: { id: { in: hobbyIds }, householdId },
      select: { id: true, name: true }
    });
    for (const hobby of hobbies) {
      resolved.set(createEntryEntityKey("hobby", hobby.id), buildContext({
        entityType: "hobby",
        entityId: hobby.id,
        label: hobby.name,
        parentEntityType: null,
        parentEntityId: null,
        parentLabel: null,
        entityUrl: `/hobbies/${hobby.id}?householdId=${householdId}`
      }));
    }
  }

  const hobbySeriesIds = Array.from(byType.get("hobby_series") ?? []);
  if (hobbySeriesIds.length > 0) {
    const hobbySeries = await prisma.hobbySeries.findMany({
      where: { id: { in: hobbySeriesIds }, householdId },
      select: {
        id: true,
        name: true,
        hobby: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    for (const series of hobbySeries) {
      resolved.set(createEntryEntityKey("hobby_series", series.id), buildContext({
        entityType: "hobby_series",
        entityId: series.id,
        label: series.name,
        parentEntityType: "hobby",
        parentEntityId: series.hobby.id,
        parentLabel: series.hobby.name,
        entityUrl: `/hobbies/${series.hobby.id}?householdId=${householdId}&seriesId=${series.id}`
      }));
    }
  }

  const sessionIds = Array.from(byType.get("hobby_session") ?? []);
  if (sessionIds.length > 0) {
    const sessions = await prisma.hobbySession.findMany({
      where: { id: { in: sessionIds }, hobby: { householdId } },
      select: {
        id: true,
        name: true,
        hobby: { select: { id: true, name: true } }
      }
    });
    for (const session of sessions) {
      resolved.set(createEntryEntityKey("hobby_session", session.id), buildContext({
        entityType: "hobby_session",
        entityId: session.id,
        label: session.name,
        parentEntityType: "hobby",
        parentEntityId: session.hobby.id,
        parentLabel: session.hobby.name,
        entityUrl: `/hobbies/${session.hobby.id}?householdId=${householdId}`
      }));
    }
  }

  const hobbyProjectIds = Array.from(byType.get("hobby_project") ?? []);
  if (hobbyProjectIds.length > 0) {
    const hobbyProjects = await prisma.hobbyProject.findMany({
      where: {
        id: { in: hobbyProjectIds },
        householdId,
      },
      select: {
        id: true,
        name: true,
        hobby: { select: { id: true, name: true } },
      }
    });
    for (const project of hobbyProjects) {
      resolved.set(createEntryEntityKey("hobby_project", project.id), buildContext({
        entityType: "hobby_project",
        entityId: project.id,
        label: project.name,
        parentEntityType: "hobby",
        parentEntityId: project.hobby.id,
        parentLabel: project.hobby.name,
        entityUrl: `/hobbies/${project.hobby.id}?householdId=${householdId}&projectId=${project.id}`
      }));
    }
  }

  const hobbyCollectionItemIds = Array.from(byType.get("hobby_collection_item") ?? []);
  if (hobbyCollectionItemIds.length > 0) {
    const items = await prisma.hobbyCollectionItem.findMany({
      where: { id: { in: hobbyCollectionItemIds }, householdId },
      select: {
        id: true,
        name: true,
        hobby: { select: { id: true, name: true } },
      },
    });

    for (const item of items) {
      resolved.set(createEntryEntityKey("hobby_collection_item", item.id), buildContext({
        entityType: "hobby_collection_item",
        entityId: item.id,
        label: item.name,
        parentEntityType: "hobby",
        parentEntityId: item.hobby.id,
        parentLabel: item.hobby.name,
        entityUrl: `/hobbies/${item.hobby.id}?householdId=${householdId}&collectionItemId=${item.id}`,
      }));
    }
  }

  const projectIds = Array.from(byType.get("project") ?? []);
  if (projectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds }, householdId, deletedAt: null },
      select: { id: true, name: true }
    });
    for (const project of projects) {
      resolved.set(createEntryEntityKey("project", project.id), buildContext({
        entityType: "project",
        entityId: project.id,
        label: project.name,
        parentEntityType: null,
        parentEntityId: null,
        parentLabel: null,
        entityUrl: `/projects/${project.id}?householdId=${householdId}`
      }));
    }
  }

  const phaseIds = Array.from(byType.get("project_phase") ?? []);
  if (phaseIds.length > 0) {
    const phases = await prisma.projectPhase.findMany({
      where: { id: { in: phaseIds }, deletedAt: null, project: { householdId, deletedAt: null } },
      select: {
        id: true,
        name: true,
        project: { select: { id: true, name: true } }
      }
    });
    for (const phase of phases) {
      resolved.set(createEntryEntityKey("project_phase", phase.id), buildContext({
        entityType: "project_phase",
        entityId: phase.id,
        label: phase.name,
        parentEntityType: "project",
        parentEntityId: phase.project.id,
        parentLabel: phase.project.name,
        entityUrl: `/projects/${phase.project.id}?householdId=${householdId}`
      }));
    }
  }

  const assetIds = Array.from(byType.get("asset") ?? []);
  if (assetIds.length > 0) {
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds }, householdId, deletedAt: null },
      select: { id: true, name: true }
    });
    for (const asset of assets) {
      resolved.set(createEntryEntityKey("asset", asset.id), buildContext({
        entityType: "asset",
        entityId: asset.id,
        label: asset.name,
        parentEntityType: null,
        parentEntityId: null,
        parentLabel: null,
        entityUrl: `/assets/${asset.id}`
      }));
    }
  }

  const scheduleIds = Array.from(byType.get("schedule") ?? []);
  if (scheduleIds.length > 0) {
    const schedules = await prisma.maintenanceSchedule.findMany({
      where: { id: { in: scheduleIds }, deletedAt: null, asset: { householdId, deletedAt: null } },
      select: {
        id: true,
        name: true,
        asset: { select: { id: true, name: true } }
      }
    });
    for (const schedule of schedules) {
      resolved.set(createEntryEntityKey("schedule", schedule.id), buildContext({
        entityType: "schedule",
        entityId: schedule.id,
        label: schedule.name,
        parentEntityType: "asset",
        parentEntityId: schedule.asset.id,
        parentLabel: schedule.asset.name,
        entityUrl: `/assets/${schedule.asset.id}?tab=maintenance`
      }));
    }
  }

  const logIds = Array.from(byType.get("maintenance_log") ?? []);
  if (logIds.length > 0) {
    const logs = await prisma.maintenanceLog.findMany({
      where: { id: { in: logIds }, deletedAt: null, asset: { householdId, deletedAt: null } },
      select: {
        id: true,
        title: true,
        asset: { select: { id: true, name: true } }
      }
    });
    for (const log of logs) {
      resolved.set(createEntryEntityKey("maintenance_log", log.id), buildContext({
        entityType: "maintenance_log",
        entityId: log.id,
        label: log.title,
        parentEntityType: "asset",
        parentEntityId: log.asset.id,
        parentLabel: log.asset.name,
        entityUrl: `/assets/${log.asset.id}?tab=maintenance`
      }));
    }
  }

  const itemIds = Array.from(byType.get("inventory_item") ?? []);
  if (itemIds.length > 0) {
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: itemIds }, householdId, deletedAt: null },
      select: { id: true, name: true }
    });
    for (const item of items) {
      resolved.set(createEntryEntityKey("inventory_item", item.id), buildContext({
        entityType: "inventory_item",
        entityId: item.id,
        label: item.name,
        parentEntityType: null,
        parentEntityId: null,
        parentLabel: null,
        entityUrl: `/inventory?householdId=${householdId}&highlight=${item.id}`
      }));
    }
  }

  const notebookIds = Array.from(byType.get("notebook") ?? []);
  if (notebookIds.length > 0) {
    for (const id of notebookIds) {
      if (id === householdId) {
        resolved.set(createEntryEntityKey("notebook", id), buildContext({
          entityType: "notebook",
          entityId: id,
          label: "Notebook",
          parentEntityType: null,
          parentEntityId: null,
          parentLabel: null,
          entityUrl: `/notes?householdId=${householdId}`
        }));
      }
    }
  }

  return resolved;
};