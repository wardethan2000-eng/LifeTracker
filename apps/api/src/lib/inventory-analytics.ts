import type { Prisma } from "@prisma/client";

type TransactionWithDate = {
  quantity: number;
  createdAt: Date;
};

type TransactionWithCost = TransactionWithDate & {
  unitCost: number | null;
};

const AVERAGE_DAYS_PER_MONTH = 30.4375;

const toMonthKey = (date: Date): string => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const computeAverageConsumptionPerMonth = (transactions: TransactionWithDate[]): number | null => {
  const consumeTransactions = transactions
    .filter((transaction) => transaction.quantity < 0)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  if (consumeTransactions.length === 0) {
    return null;
  }

  const earliest = consumeTransactions[0]?.createdAt ?? new Date();
  const latest = consumeTransactions[consumeTransactions.length - 1]?.createdAt ?? earliest;
  const now = new Date();
  const spanInMonths = Math.max(
    1,
    ((now.getUTCFullYear() - earliest.getUTCFullYear()) * 12)
      + (now.getUTCMonth() - earliest.getUTCMonth())
      + 1
  );
  const _latestConsumeAt = latest;
  void _latestConsumeAt;
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