import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, householdId, userId, householdMemberMock, fixedDate, secondUserId } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────
const activityMocks = vi.hoisted(() => ({
  log: vi.fn(async () => undefined),
}));

const searchMocks = vi.hoisted(() => ({
  syncInvitationToSearchIndex: vi.fn(async () => undefined),
}));

const accessMocks = vi.hoisted(() => ({
  assertOwner: vi.fn(async () => undefined),   // defaults to allowing owner actions
  assertMembership: vi.fn(async () => undefined),
}));

vi.mock("../src/lib/activity-log.js", () => ({
  logActivity: vi.fn(async () => undefined),
  createActivityLogger: vi.fn(() => ({ log: activityMocks.log })),
}));

vi.mock("../src/lib/search-index.js", () => ({
  syncInvitationToSearchIndex: searchMocks.syncInvitationToSearchIndex,
}));

vi.mock("../src/lib/asset-access.js", () => ({
  assertOwner: accessMocks.assertOwner,
  assertMembership: accessMocks.assertMembership,
  requireHouseholdMembership: vi.fn(async () => true),
  getAccessibleAsset: vi.fn(),
}));

import { invitationRoutes } from "../src/routes/invitations/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const invitationId = "clkeeperinvite00000000001";
const token = "abc123-test-token";
const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);   // 24 h from now
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);     // 24 h ago

const buildInvitationRecord = (overrides: Record<string, unknown> = {}) => ({
  id: invitationId,
  householdId,
  invitedByUserId: userId,
  email: "friend@example.com",
  token,
  status: "pending" as const,
  expiresAt: futureDate,
  acceptedAt: null,
  acceptedByUserId: null,
  revokedAt: null,
  revokedByUserId: null,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  ...overrides,
});

const buildHousehold = () => ({
  id: householdId,
  name: "The Smith Household",
  createdById: userId,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  _count: { members: 2 },
});

const buildPrisma = (
  invitation: ReturnType<typeof buildInvitationRecord> | null = buildInvitationRecord()
) => ({
  householdMember: householdMemberMock,
  householdInvitation: {
    create: vi.fn(async () => invitation ?? buildInvitationRecord()),
    findMany: vi.fn(async () => (invitation ? [invitation] : [])),
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (!invitation) return null;
      if (where.token && where.token !== invitation.token) return null;
      if (where.id && where.id !== invitation.id) return null;
      return invitation;
    }),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (!invitation) return null;
      if (where.id && where.id !== invitation.id) return null;
      if (where.status && where.status !== invitation.status) return null;
      return invitation;
    }),
    update: vi.fn(async () => ({ ...invitation, status: "accepted" })),
  },
  household: {
    findUnique: vi.fn(async () => buildHousehold()),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txPrisma = {
      householdMember: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({ householdId, userId: secondUserId, role: "member" })),
      },
      householdInvitation: {
        update: vi.fn(async () => ({ ...invitation, status: "accepted" })),
      },
      household: {
        findUnique: vi.fn(async () => buildHousehold()),
      },
    };
    return fn(txPrisma);
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to allow owner by default
  accessMocks.assertOwner.mockResolvedValue(undefined);
  accessMocks.assertMembership.mockResolvedValue(undefined);
});

// ─── Create invitation ────────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/invitations", () => {
  it("creates an invitation and returns 201 with token", async () => {
    const prisma = buildPrisma();
    const app = await buildApp(invitationRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations`,
      payload: { email: "friend@example.com", expirationHours: 48 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<Record<string, unknown>>();
    expect(body.email).toBe("friend@example.com");
    expect(body.status).toBe("pending");
    expect(prisma.householdInvitation.create).toHaveBeenCalledTimes(1);
  });

  it("records an activity log entry", async () => {
    const app = await buildApp(invitationRoutes, buildPrisma());
    await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations`,
      payload: { email: "friend@example.com", expirationHours: 24 },
    });

    expect(activityMocks.log).toHaveBeenCalledWith("invitation", expect.any(String), "member.invited", householdId, expect.any(Object));
  });

  it("returns 403 when caller is not an owner", async () => {
    accessMocks.assertOwner.mockRejectedValue(new Error("forbidden"));
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations`,
      payload: { email: "friend@example.com", expirationHours: 24 },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json<{ message: string }>().message).toContain("owner");
  });

  it("returns 400 when email is missing", async () => {
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations`,
      payload: { expirationHours: 24 },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── List invitations ─────────────────────────────────────────────────────────
describe("GET /v1/households/:householdId/invitations", () => {
  it("returns the list of invitations for the household", async () => {
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/invitations`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<unknown[]>();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it("returns 403 when caller is not a member", async () => {
    accessMocks.assertMembership.mockRejectedValue(new Error("forbidden"));
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "GET",
      url: `/v1/households/${householdId}/invitations`,
    });

    expect(res.statusCode).toBe(403);
  });
});

// ─── Accept invitation via token ──────────────────────────────────────────────
describe("POST /v1/invitations/accept", () => {
  it("accepts a valid pending invitation and returns the household", async () => {
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/invitations/accept`,
      payload: { token },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; myRole: string }>();
    expect(body.id).toBe(householdId);
    expect(body.myRole).toBe("member");
  });

  it("returns 404 when token does not match any invitation", async () => {
    const app = await buildApp(invitationRoutes, buildPrisma(null));
    const res = await app.inject({
      method: "POST",
      url: `/v1/invitations/accept`,
      payload: { token: "nonexistent-token" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 when invitation is already accepted", async () => {
    const alreadyAccepted = buildInvitationRecord({ status: "accepted" });
    const app = await buildApp(invitationRoutes, buildPrisma(alreadyAccepted));
    const res = await app.inject({
      method: "POST",
      url: `/v1/invitations/accept`,
      payload: { token },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ message: string }>().message).toContain("accepted");
  });

  it("returns 400 and marks the invitation expired when it is past the expiry date", async () => {
    const expired = buildInvitationRecord({ expiresAt: pastDate });
    const prisma = buildPrisma(expired);
    // Override the findUnique to return the expired invitation
    (prisma.householdInvitation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(expired);
    const app = await buildApp(invitationRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/invitations/accept`,
      payload: { token },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ message: string }>().message).toContain("expired");
    expect(prisma.householdInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "expired" }) })
    );
  });

  it("returns 400 when token is missing from body", async () => {
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/invitations/accept`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── Revoke invitation ────────────────────────────────────────────────────────
describe("POST /v1/households/:householdId/invitations/:invitationId/revoke", () => {
  it("revokes a pending invitation and returns the updated record", async () => {
    const prisma = buildPrisma();
    // Return a pending invitation from findFirst
    (prisma.householdInvitation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildInvitationRecord({ status: "pending" })
    );
    const app = await buildApp(invitationRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations/${invitationId}/revoke`,
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.householdInvitation.update).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when caller is not an owner", async () => {
    accessMocks.assertOwner.mockRejectedValue(new Error("forbidden"));
    const app = await buildApp(invitationRoutes, buildPrisma());
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations/${invitationId}/revoke`,
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when there is no pending invitation with that id", async () => {
    const prisma = buildPrisma();
    (prisma.householdInvitation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = await buildApp(invitationRoutes, prisma);
    const res = await app.inject({
      method: "POST",
      url: `/v1/households/${householdId}/invitations/${invitationId}/revoke`,
    });

    expect(res.statusCode).toBe(404);
  });
});
