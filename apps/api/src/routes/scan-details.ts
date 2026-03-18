import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { checkMembership } from "../lib/asset-access.js";
import { recordSpaceScanLog } from "../lib/space-scan-log.js";
import {
  serializeSpace,
  toInventoryItemDetailResponse
} from "../lib/serializers/index.js";
import { getSpaceBreadcrumb } from "../lib/spaces.js";

const scanTagParamsSchema = z.object({
  tag: z.string().trim().min(1).max(120)
});

const inventoryDetailQuerySchema = z.object({
  transactionLimit: z.coerce.number().int().min(1).max(100).default(20)
});

const activeChildrenOrderBy = [
  { sortOrder: "asc" as const },
  { name: "asc" as const }
];

const spaceDetailInclude = {
  parent: true,
  children: {
    where: { deletedAt: null },
    orderBy: activeChildrenOrderBy
  },
  spaceItems: {
    include: {
      inventoryItem: true
    },
    where: {
      inventoryItem: {
        deletedAt: null
      }
    },
    orderBy: [
      { createdAt: "desc" as const },
      { id: "desc" as const }
    ]
  },
  generalItems: {
    where: { deletedAt: null },
    orderBy: [
      { createdAt: "desc" as const },
      { id: "desc" as const }
    ]
  }
} satisfies Prisma.SpaceInclude;

export const scanDetailRoutes: FastifyPluginAsync = async (app) => {
  app.get("/v1/scan/spaces/:tag/detail", async (request, reply) => {
    const params = scanTagParamsSchema.parse(request.params);

    const space = await app.prisma.space.findFirst({
      where: {
        scanTag: params.tag,
        deletedAt: null
      },
      include: spaceDetailInclude
    });

    if (!space) {
      return reply.code(404).send({ message: "Space not found." });
    }

    if (!await checkMembership(app.prisma, space.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    await recordSpaceScanLog(app.prisma, {
      householdId: space.householdId,
      spaceId: space.id,
      userId: request.auth.userId,
      method: "qr_scan"
    });

    const breadcrumb = await getSpaceBreadcrumb(app.prisma, space.id);
    return serializeSpace(space, { breadcrumb });
  });

  app.get("/v1/scan/inventory-items/:tag/detail", async (request, reply) => {
    const params = scanTagParamsSchema.parse(request.params);
    const query = inventoryDetailQuerySchema.parse(request.query);

    const item = await app.prisma.inventoryItem.findFirst({
      where: {
        scanTag: params.tag,
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

    if (!await checkMembership(app.prisma, item.householdId, request.auth.userId)) {
      return reply.code(403).send({ message: "You do not have access to this household." });
    }

    const spaceBreadcrumbs = await Promise.all(item.spaceLinks.map((link) => getSpaceBreadcrumb(app.prisma, link.space.id)));

    return toInventoryItemDetailResponse({
      ...item,
      spaceLinks: item.spaceLinks.map((link, index) => ({
        ...link,
        space: {
          ...link.space,
          breadcrumb: spaceBreadcrumbs[index] ?? []
        }
      }))
    });
  });
};