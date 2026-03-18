import type { Prisma, PrismaClient } from "@prisma/client";

type HobbySeriesPrisma = PrismaClient | Prisma.TransactionClient;

export const getNextHobbySeriesBatchNumber = async (
  prisma: HobbySeriesPrisma,
  seriesId: string
): Promise<number> => {
  const result = await prisma.hobbySession.aggregate({
    where: { seriesId },
    _max: { batchNumber: true }
  });

  return (result._max.batchNumber ?? 0) + 1;
};

export const syncHobbySeriesBatchCount = async (
  prisma: HobbySeriesPrisma,
  seriesId: string
): Promise<void> => {
  const series = await prisma.hobbySeries.findUnique({
    where: { id: seriesId },
    select: { bestBatchSessionId: true }
  });

  if (!series) {
    return;
  }

  const [batchCount, bestBatchStillLinked] = await Promise.all([
    prisma.hobbySession.count({ where: { seriesId } }),
    series.bestBatchSessionId
      ? prisma.hobbySession.count({
          where: {
            id: series.bestBatchSessionId,
            seriesId
          }
        })
      : Promise.resolve(0)
  ]);

  await prisma.hobbySeries.update({
    where: { id: seriesId },
    data: {
      batchCount,
      ...(series.bestBatchSessionId && bestBatchStillLinked === 0
        ? { bestBatchSessionId: null }
        : {})
    }
  });
};

export const updateHobbySessionSeriesLink = async (
  prisma: HobbySeriesPrisma,
  sessionId: string,
  nextSeriesId: string | null,
  nextBatchNumber: number | null
) => {
  const existing = await prisma.hobbySession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { seriesId: true }
  });

  const updated = await prisma.hobbySession.update({
    where: { id: sessionId },
    data: {
      seriesId: nextSeriesId,
      batchNumber: nextSeriesId ? nextBatchNumber : null
    }
  });

  const impactedSeriesIds = new Set<string>();
  if (existing.seriesId) {
    impactedSeriesIds.add(existing.seriesId);
  }
  if (nextSeriesId) {
    impactedSeriesIds.add(nextSeriesId);
  }

  for (const seriesId of impactedSeriesIds) {
    await syncHobbySeriesBatchCount(prisma, seriesId);
  }

  return updated;
};