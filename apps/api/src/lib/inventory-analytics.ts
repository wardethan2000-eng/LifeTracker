import type { Prisma, PrismaClient } from "@prisma/client";
import { toMonthKey } from "@lifekeeper/utils";

type TransactionWithDate = {
  quantity: number;
  createdAt: Date;
};

type TransactionWithCost = TransactionWithDate & {
  unitCost: number | null;
};

type InventoryAnalyticsPrisma = PrismaClient | Prisma.TransactionClient;

const AVERAGE_DAYS_PER_MONTH = 30.4375;

export const computeAverageConsumptionPerMonth = (transactions: TransactionWithDate[]): number | null => {
  const consumeTransactions = transactions
    .filter((transaction) => transaction.quantity < 0)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  if (consumeTransactions.length === 0) {
    return null;
  }

  const earliest = consumeTransactions[0]?.createdAt ?? new Date();
  const now = new Date();
  const spanInMonths = Math.max(
    1,
    ((now.getUTCFullYear() - earliest.getUTCFullYear()) * 12)
      + (now.getUTCMonth() - earliest.getUTCMonth())
      + 1
  );
  const totalConsumed = consumeTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.quantity), 0);

  return totalConsumed / spanInMonths;
};

export const computeProjectedDate = (
  currentStock: number,
  ratePerMonth: number,
  targetStock: number
): Date | null => {
  if (ratePerMonth <= 0 || currentStock <= targetStock) {
    return null;
  }

  const monthsUntilTarget = (currentStock - targetStock) / ratePerMonth;

  if (!Number.isFinite(monthsUntilTarget) || monthsUntilTarget <= 0) {
    return null;
  }

  return new Date(Date.now() + (monthsUntilTarget * AVERAGE_DAYS_PER_MONTH * 24 * 60 * 60 * 1000));
};

export const computeTurnoverRate = (consumedLast12Months: number, averageOnHand: number): number | null => {
  if (averageOnHand === 0) {
    return null;
  }

  return consumedLast12Months / averageOnHand;
};

export const classifyVelocity = (
  daysSinceLastConsumption: number | null
): "fast" | "moderate" | "slow" | "stale" => {
  if (daysSinceLastConsumption === null) {
    return "stale";
  }

  if (daysSinceLastConsumption <= 30) {
    return "fast";
  }

  if (daysSinceLastConsumption <= 90) {
    return "moderate";
  }

  if (daysSinceLastConsumption <= 365) {
    return "slow";
  }

  return "stale";
};

export const classifyReorderUrgency = (
  daysUntilReorder: number | null,
  quantityOnHand: number,
  reorderThreshold: number | null
): "critical" | "soon" | "planned" | "healthy" => {
  if (quantityOnHand === 0 || (reorderThreshold !== null && quantityOnHand <= reorderThreshold)) {
    return "critical";
  }

  if (daysUntilReorder !== null && daysUntilReorder <= 14) {
    return "soon";
  }

  if (daysUntilReorder !== null && daysUntilReorder <= 60) {
    return "planned";
  }

  return "healthy";
};

export const groupTransactionsByMonth = (
  transactions: TransactionWithCost[],
  months: number
): Array<{ month: string; totalCost: number; quantity: number; transactionCount: number; averageCost: number }> => {
  const now = new Date();
  const monthKeys = Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - index - 1), 1));
    return toMonthKey(date);
  });

  const buckets = monthKeys.reduce<Map<string, {
    month: string;
    totalCost: number;
    quantity: number;
    transactionCount: number;
  }>>((map, month) => {
    map.set(month, {
      month,
      totalCost: 0,
      quantity: 0,
      transactionCount: 0
    });
    return map;
  }, new Map());

  for (const transaction of transactions) {
    if (transaction.quantity >= 0) {
      continue;
    }

    const bucket = buckets.get(toMonthKey(transaction.createdAt));

    if (!bucket) {
      continue;
    }

    const quantity = Math.abs(transaction.quantity);
    bucket.quantity += quantity;
    bucket.transactionCount += 1;

    if (transaction.unitCost !== null) {
      bucket.totalCost += quantity * transaction.unitCost;
    }
  }

  return monthKeys.map((month) => {
    const bucket = buckets.get(month) ?? {
      month,
      totalCost: 0,
      quantity: 0,
      transactionCount: 0
    };

    return {
      month,
      totalCost: bucket.totalCost,
      quantity: bucket.quantity,
      transactionCount: bucket.transactionCount,
      averageCost: bucket.quantity > 0 ? bucket.totalCost / bucket.quantity : 0
    };
  });
};

const toNumber = (value: bigint | number | string | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return value;
};

export const getHouseholdInventorySpendTotals = async (
  prisma: InventoryAnalyticsPrisma,
  householdId: string,
  ranges: {
    last30DaysStart: Date;
    last90DaysStart: Date;
    last12MonthsStart: Date;
  }
): Promise<{
  totalSpentLast30Days: number;
  totalSpentLast90Days: number;
  totalSpentLast12Months: number;
}> => {
  const rows = await prisma.$queryRaw<Array<{
    totalSpentLast30Days: number | null;
    totalSpentLast90Days: number | null;
    totalSpentLast12Months: number | null;
  }>>`
    SELECT
      COALESCE(SUM(CASE
        WHEN transaction.quantity < 0
          AND transaction."unitCost" IS NOT NULL
          AND transaction."createdAt" >= ${ranges.last30DaysStart}
        THEN ABS(transaction.quantity) * transaction."unitCost"
        ELSE 0
      END), 0) AS "totalSpentLast30Days",
      COALESCE(SUM(CASE
        WHEN transaction.quantity < 0
          AND transaction."unitCost" IS NOT NULL
          AND transaction."createdAt" >= ${ranges.last90DaysStart}
        THEN ABS(transaction.quantity) * transaction."unitCost"
        ELSE 0
      END), 0) AS "totalSpentLast90Days",
      COALESCE(SUM(CASE
        WHEN transaction.quantity < 0
          AND transaction."unitCost" IS NOT NULL
          AND transaction."createdAt" >= ${ranges.last12MonthsStart}
        THEN ABS(transaction.quantity) * transaction."unitCost"
        ELSE 0
      END), 0) AS "totalSpentLast12Months"
    FROM "InventoryTransaction" transaction
    INNER JOIN "InventoryItem" item ON item.id = transaction."inventoryItemId"
    WHERE item."householdId" = ${householdId}
      AND item."deletedAt" IS NULL
      AND transaction."createdAt" >= ${ranges.last12MonthsStart}
  `;

  const row = rows[0];

  return {
    totalSpentLast30Days: toNumber(row?.totalSpentLast30Days),
    totalSpentLast90Days: toNumber(row?.totalSpentLast90Days),
    totalSpentLast12Months: toNumber(row?.totalSpentLast12Months)
  };
};

export const getHouseholdInventoryItemSpend = async (
  prisma: InventoryAnalyticsPrisma,
  householdId: string,
  since: Date
): Promise<Array<{
  inventoryItemId: string;
  totalSpent: number;
}>> => {
  const rows = await prisma.$queryRaw<Array<{
    inventoryItemId: string;
    totalSpent: number | null;
  }>>`
    SELECT
      transaction."inventoryItemId" AS "inventoryItemId",
      COALESCE(SUM(ABS(transaction.quantity) * transaction."unitCost"), 0) AS "totalSpent"
    FROM "InventoryTransaction" transaction
    INNER JOIN "InventoryItem" item ON item.id = transaction."inventoryItemId"
    WHERE item."householdId" = ${householdId}
      AND item."deletedAt" IS NULL
      AND transaction.quantity < 0
      AND transaction."unitCost" IS NOT NULL
      AND transaction."createdAt" >= ${since}
    GROUP BY transaction."inventoryItemId"
  `;

  return rows.map((row) => ({
    inventoryItemId: row.inventoryItemId,
    totalSpent: toNumber(row.totalSpent)
  }));
};

export const getHouseholdInventoryCategorySpend = async (
  prisma: InventoryAnalyticsPrisma,
  householdId: string,
  since: Date
): Promise<Array<{
  category: string;
  totalSpentLast12Months: number;
}>> => {
  const rows = await prisma.$queryRaw<Array<{
    category: string;
    totalSpentLast12Months: number | null;
  }>>`
    SELECT
      COALESCE(NULLIF(BTRIM(item.category), ''), 'Uncategorized') AS category,
      COALESCE(SUM(ABS(transaction.quantity) * transaction."unitCost"), 0) AS "totalSpentLast12Months"
    FROM "InventoryTransaction" transaction
    INNER JOIN "InventoryItem" item ON item.id = transaction."inventoryItemId"
    WHERE item."householdId" = ${householdId}
      AND item."deletedAt" IS NULL
      AND transaction.quantity < 0
      AND transaction."unitCost" IS NOT NULL
      AND transaction."createdAt" >= ${since}
    GROUP BY COALESCE(NULLIF(BTRIM(item.category), ''), 'Uncategorized')
  `;

  return rows.map((row) => ({
    category: row.category,
    totalSpentLast12Months: toNumber(row.totalSpentLast12Months)
  }));
};

export const getHouseholdInventoryMonthlySpending = async (
  prisma: InventoryAnalyticsPrisma,
  householdId: string,
  since: Date
): Promise<Array<{
  month: string;
  totalSpent: number;
  transactionCount: number;
}>> => {
  const rows = await prisma.$queryRaw<Array<{
    month: string;
    totalSpent: number | null;
    transactionCount: number | null;
  }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', transaction."createdAt"), 'YYYY-MM') AS month,
      COALESCE(SUM(ABS(transaction.quantity) * transaction."unitCost"), 0) AS "totalSpent",
      COUNT(*)::int AS "transactionCount"
    FROM "InventoryTransaction" transaction
    INNER JOIN "InventoryItem" item ON item.id = transaction."inventoryItemId"
    WHERE item."householdId" = ${householdId}
      AND item."deletedAt" IS NULL
      AND transaction.quantity < 0
      AND transaction."unitCost" IS NOT NULL
      AND transaction."createdAt" >= ${since}
    GROUP BY DATE_TRUNC('month', transaction."createdAt")
    ORDER BY DATE_TRUNC('month', transaction."createdAt") ASC
  `;

  return rows.map((row) => ({
    month: row.month,
    totalSpent: toNumber(row.totalSpent),
    transactionCount: toNumber(row.transactionCount)
  }));
};

export type InventoryAnalyticsTransactionPoint = Pick<
  Prisma.InventoryTransactionGetPayload<{
    select: {
      quantity: true;
      unitCost: true;
      createdAt: true;
    };
  }>,
  "quantity" | "unitCost" | "createdAt"
>;