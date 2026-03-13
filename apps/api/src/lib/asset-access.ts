import type { Asset, Prisma, PrismaClient } from "@prisma/client";

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
