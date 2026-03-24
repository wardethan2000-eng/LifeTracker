import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activityMocks = vi.hoisted(() => ({
  logActivity: vi.fn(async () => ({ id: "clkeeperactivity00000000001" })),
}));

const searchMocks = vi.hoisted(() => ({
  syncHobbyToSearchIndex: vi.fn(async () => undefined),
  removeSearchIndexEntry: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: activityMocks.logActivity,
  createActivityLogger: vi.fn(() => ({ log: vi.fn(async () => undefined) }))
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncHobbyToSearchIndex: searchMocks.syncHobbyToSearchIndex,
  removeSearchIndexEntry: searchMocks.removeSearchIndexEntry,
}));

import { hobbyRoutes } from "../src/routes/hobbies/index.js";

const householdId = "clkeeperhouse000000000001";
const hobbyId = "clkeeperhobby000000000001";
const userId = "clkeeperuser0000000000001";

const hobbyRecord = {
  id: hobbyId,
  householdId,
  name: "Coffee Roasting",
  description: null,
  status: "active",
  activityMode: "session",
  hobbyType: "Roasting",
  lifecycleMode: "pipeline",
  customFields: {},
  fieldDefinitions: [],
  notes: null,
  createdById: userId,
  createdAt: new Date("2026-03-17T00:00:00.000Z"),
  updatedAt: new Date("2026-03-17T00:00:00.000Z"),
};

const createApp = async (prisma: object) => {
  const app = Fastify();

  app.decorate("prisma", prisma as never);
  app.decorateRequest("auth", undefined as never);
  app.addHook("preHandler", async (request) => {
    request.auth = {
      userId,
      clerkUserId: null,
      source: "dev-bypass",
    };
  });

  await app.register(hobbyRoutes);

  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hobby routes", () => {
  it("creates a hobby with a custom pipeline", async () => {
    const tx = {
      hobby: {
        create: vi.fn(async () => hobbyRecord),
      },
      hobbySessionStatusStep: {
        findMany: vi.fn(async () => []),
        createMany: vi.fn(async () => ({ count: 3 })),
      },
      hobbySession: {
        updateMany: vi.fn(async () => ({ count: 0 })),
      }
    };

    const app = await createApp({
      householdMember: {
        findUnique: async () => ({ householdId, userId, role: "owner" })
      },
      $transaction: async <T>(callback: (prismaTx: typeof tx) => Promise<T>) => callback(tx)
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: `/v1/households/${householdId}/hobbies`,
        payload: {
          name: "Coffee Roasting",
          lifecycleMode: "pipeline",
          statusPipeline: [
            { label: "Green Beans", sortOrder: 0, isFinal: false, color: "#a16207" },
            { label: "Roasting", sortOrder: 1, isFinal: false, color: "#b45309" },
            { label: "Finished", sortOrder: 2, isFinal: true, color: "#166534" },
          ]
        }
      });

      expect(response.statusCode).toBe(201);
      expect(tx.hobby.create).toHaveBeenCalledTimes(1);
      expect(tx.hobbySessionStatusStep.createMany).toHaveBeenCalledWith({
        data: [
          {
            hobbyId,
            label: "Green Beans",
            sortOrder: 0,
            color: "#a16207",
            isFinal: false,
            description: null,
            instructions: null,
            futureNotes: null,
            fieldDefinitions: [],
            checklistTemplates: [],
            supplyTemplates: [],
          },
          {
            hobbyId,
            label: "Roasting",
            sortOrder: 1,
            color: "#b45309",
            isFinal: false,
            description: null,
            instructions: null,
            futureNotes: null,
            fieldDefinitions: [],
            checklistTemplates: [],
            supplyTemplates: [],
          },
          {
            hobbyId,
            label: "Finished",
            sortOrder: 2,
            color: "#166534",
            isFinal: true,
            description: null,
            instructions: null,
            futureNotes: null,
            fieldDefinitions: [],
            checklistTemplates: [],
            supplyTemplates: [],
          },
        ]
      });
    } finally {
      await app.close();
    }
  });

  it("updates pipeline steps and clears removed session step references", async () => {
    const tx = {
      hobby: {
        update: vi.fn(async () => hobbyRecord),
      },
      hobbySessionStatusStep: {
        findMany: vi.fn(async () => [
          { id: "clkeeperstep000000000001" },
          { id: "clkeeperstep000000000002" },
        ]),
        update: vi.fn(async () => undefined),
        createMany: vi.fn(async () => ({ count: 1 })),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
      hobbySession: {
        updateMany: vi.fn(async () => ({ count: 2 })),
      }
    };

    const app = await createApp({
      householdMember: {
        findUnique: async () => ({ householdId, userId, role: "owner" })
      },
      hobby: {
        findFirst: async () => ({
          ...hobbyRecord,
          statusPipeline: [
            { id: "clkeeperstep000000000001" },
            { id: "clkeeperstep000000000002" },
          ]
        })
      },
      $transaction: async <T>(callback: (prismaTx: typeof tx) => Promise<T>) => callback(tx)
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/v1/households/${householdId}/hobbies/${hobbyId}`,
        payload: {
          statusPipeline: [
            { id: "clkeeperstep000000000001", label: "Roasting", sortOrder: 0, isFinal: false, color: "#b45309" },
            { label: "Cooling", sortOrder: 1, isFinal: true, color: "#0f766e" },
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(tx.hobbySessionStatusStep.update).toHaveBeenCalledWith({
        where: { id: "clkeeperstep000000000001" },
        data: {
          label: "Roasting",
          sortOrder: 0,
          color: "#b45309",
          isFinal: false,
          description: null,
          instructions: null,
          futureNotes: null,
          fieldDefinitions: [],
          checklistTemplates: [],
          supplyTemplates: [],
        }
      });
      expect(tx.hobbySession.updateMany).toHaveBeenCalledWith({
        where: {
          hobbyId,
          pipelineStepId: { in: ["clkeeperstep000000000002"] },
        },
        data: { pipelineStepId: null },
      });
      expect(tx.hobbySessionStatusStep.deleteMany).toHaveBeenCalledWith({
        where: {
          hobbyId,
          id: { in: ["clkeeperstep000000000002"] },
        }
      });
      expect(tx.hobbySessionStatusStep.createMany).toHaveBeenCalledWith({
        data: [
          {
            hobbyId,
            label: "Cooling",
            sortOrder: 1,
            color: "#0f766e",
            isFinal: true,
            description: null,
            instructions: null,
            futureNotes: null,
            fieldDefinitions: [],
            checklistTemplates: [],
            supplyTemplates: [],
          }
        ]
      });
    } finally {
      await app.close();
    }
  });
});