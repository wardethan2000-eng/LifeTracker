import type { InventoryTransaction, PrismaClient } from "@prisma/client";
import type { InventoryTransactionReferenceLink } from "@lifekeeper/types";

type TransactionReferenceRecord = Pick<InventoryTransaction, "referenceType" | "referenceId">;

type InventoryReferencePrisma = Pick<
  PrismaClient,
  "maintenanceLog" | "project" | "hobbyProject" | "hobbySession" | "inventoryTransaction"
>;

export const getInventoryTransactionReferenceKey = (
  referenceType: string | null,
  referenceId: string | null
): string | null => (referenceType && referenceId ? `${referenceType}:${referenceId}` : null);

const uniqueReferenceIds = (
  transactions: TransactionReferenceRecord[],
  referenceType: string
): string[] => [...new Set(
  transactions
    .filter((transaction) => transaction.referenceType === referenceType && transaction.referenceId)
    .map((transaction) => transaction.referenceId as string)
)];

const formatInventoryTransactionType = (value: string): string => value
  .replace(/_/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

export const resolveInventoryTransactionReferenceLinks = async (
  prisma: InventoryReferencePrisma,
  householdId: string,
  transactions: TransactionReferenceRecord[]
): Promise<Map<string, InventoryTransactionReferenceLink>> => {
  const maintenanceLogIds = uniqueReferenceIds(transactions, "maintenance_log");
  const projectIds = uniqueReferenceIds(transactions, "project");
  const hobbyProjectIds = uniqueReferenceIds(transactions, "hobby_project");
  const hobbySessionIds = uniqueReferenceIds(transactions, "hobby_session");
  const inventoryTransactionIds = uniqueReferenceIds(transactions, "inventory_transaction");

  const [maintenanceLogs, projects, hobbyProjects, hobbySessions, inventoryTransactions] = await Promise.all([
    maintenanceLogIds.length > 0
      ? prisma.maintenanceLog.findMany({
          where: {
            id: { in: maintenanceLogIds },
            asset: {
              householdId,
              isArchived: false
            },
            deletedAt: null
          },
          select: {
            id: true,
            title: true,
            assetId: true,
            asset: {
              select: {
                name: true
              }
            }
          }
        })
      : Promise.resolve([]),
    projectIds.length > 0
      ? prisma.project.findMany({
          where: {
            id: { in: projectIds },
            householdId,
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        })
      : Promise.resolve([]),
    hobbyProjectIds.length > 0
      ? prisma.hobbyProject.findMany({
          where: {
            id: { in: hobbyProjectIds },
            householdId,
          },
          select: {
            id: true,
            name: true,
            hobbyId: true,
            hobby: {
              select: {
                name: true
              }
            }
          }
        })
      : Promise.resolve([]),
    hobbySessionIds.length > 0
      ? prisma.hobbySession.findMany({
          where: {
            id: { in: hobbySessionIds },
            hobby: {
              householdId
            }
          },
          select: {
            id: true,
            name: true,
            hobbyId: true,
            hobby: {
              select: {
                name: true
              }
            }
          }
        })
      : Promise.resolve([]),
    inventoryTransactionIds.length > 0
      ? prisma.inventoryTransaction.findMany({
          where: {
            id: { in: inventoryTransactionIds },
            inventoryItem: {
              householdId,
              deletedAt: null
            }
          },
          select: {
            id: true,
            type: true,
            inventoryItemId: true,
            inventoryItem: {
              select: {
                name: true
              }
            }
          }
        })
      : Promise.resolve([])
  ]);

  const links = new Map<string, InventoryTransactionReferenceLink>();

  maintenanceLogs.forEach((log) => {
    const key = getInventoryTransactionReferenceKey("maintenance_log", log.id);

    if (key) {
      links.set(key, {
        href: `/assets/${log.assetId}/maintenance#maintenance-log-${log.id}`,
        label: log.title,
        secondaryLabel: log.asset.name
      });
    }
  });

  projects.forEach((project) => {
    const key = getInventoryTransactionReferenceKey("project", project.id);

    if (key) {
      links.set(key, {
        href: `/projects/${project.id}?householdId=${householdId}`,
        label: project.name,
        secondaryLabel: "Project"
      });
    }
  });

  hobbyProjects.forEach((project) => {
    const key = getInventoryTransactionReferenceKey("hobby_project", project.id);

    if (key) {
      links.set(key, {
        href: `/hobbies/${project.hobbyId}?householdId=${householdId}&projectId=${project.id}`,
        label: project.name,
        secondaryLabel: project.hobby.name
      });
    }
  });

  hobbySessions.forEach((session) => {
    const key = getInventoryTransactionReferenceKey("hobby_session", session.id);

    if (key) {
      links.set(key, {
        href: `/hobbies/${session.hobbyId}/sessions/${session.id}`,
        label: session.name,
        secondaryLabel: session.hobby.name
      });
    }
  });

  inventoryTransactions.forEach((transaction) => {
    const key = getInventoryTransactionReferenceKey("inventory_transaction", transaction.id);

    if (key) {
      links.set(key, {
        href: `/inventory/${transaction.inventoryItemId}?householdId=${householdId}#inventory-transaction-${transaction.id}`,
        label: `${formatInventoryTransactionType(transaction.type)} Transaction`,
        secondaryLabel: transaction.inventoryItem.name
      });
    }
  });

  return links;
};