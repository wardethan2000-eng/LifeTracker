import type { Asset, Prisma, PrismaClient } from "@prisma/client";
import type { FastifyReply } from "fastify";

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
  }
}

export const membershipWhere = (householdId: string, userId: string) => ({
  householdId,
  userId
});

export const personalAssetAccessWhere = (userId: string): Prisma.AssetWhereInput => ({
  OR: [
    { visibility: "shared" },
    { ownerId: userId },
    {
      AND: [
        { ownerId: null },
        { createdById: userId }
      ]
    }
  ]
});

export const accessibleAssetWhere = (assetId: string, userId: string): Prisma.AssetWhereInput => ({
  id: assetId,
  household: {
    members: {
      some: {
        userId
      }
    }
  },
  ...personalAssetAccessWhere(userId)
});

export const assertMembership = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string
): Promise<void> => {
  const membership = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: membershipWhere(householdId, userId)
    }
  });

  if (!membership) {
    throw new ForbiddenError();
  }
};

export const requireHouseholdMembership = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string,
  reply: FastifyReply
): Promise<boolean> => {
  try {
    await assertMembership(prisma, householdId, userId);
    return true;
  } catch {
    await reply.code(403).send({ message: "You do not have access to this household." });
    return false;
  }
};

export const checkMembership = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string
): Promise<boolean> => {
  try {
    await assertMembership(prisma, householdId, userId);
    return true;
  } catch {
    return false;
  }
};

export const getMembership = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string
) => prisma.householdMember.findUnique({
  where: {
    householdId_userId: membershipWhere(householdId, userId)
  }
});

export const assertOwner = async (
  prisma: PrismaClient,
  householdId: string,
  userId: string
): Promise<void> => {
  const membership = await getMembership(prisma, householdId, userId);

  if (!membership || membership.role !== "owner") {
    throw new ForbiddenError();
  }
};

export const getAccessibleAsset = async (
  prisma: PrismaClient,
  assetId: string,
  userId: string
): Promise<Asset | null> => prisma.asset.findFirst({
  where: accessibleAssetWhere(assetId, userId)
});
