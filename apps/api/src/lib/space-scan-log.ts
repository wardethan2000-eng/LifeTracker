import type { Prisma, PrismaClient, SpaceScanMethod } from "@prisma/client";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const recordSpaceScanLog = async (
  prisma: PrismaLike,
  params: {
    householdId: string;
    spaceId: string;
    userId: string;
    method: SpaceScanMethod;
  }
): Promise<void> => {
  await prisma.spaceScanLog.create({
    data: {
      householdId: params.householdId,
      spaceId: params.spaceId,
      userId: params.userId,
      method: params.method
    }
  });
};
