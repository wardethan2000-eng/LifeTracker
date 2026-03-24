import type { Prisma, SpaceScanMethod } from "@prisma/client";
import type { PrismaExecutor } from "./prisma-types.js";


export const recordSpaceScanLog = async (
  prisma: PrismaExecutor,
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
