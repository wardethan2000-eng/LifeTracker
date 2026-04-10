import type { Loan } from "@prisma/client";
import { loanSchema } from "@aegis/types";

export const toLoanResponse = (
  loan: Pick<Loan, "id" | "householdId" | "entityType" | "entityId" | "borrowerName" | "borrowerContact" | "quantity" | "notes" | "lentAt" | "expectedReturnAt" | "returnedAt" | "createdAt" | "updatedAt"> & {
    entityName?: string;
  }
) => loanSchema.parse({
  id: loan.id,
  householdId: loan.householdId,
  entityType: loan.entityType,
  entityId: loan.entityId,
  borrowerName: loan.borrowerName,
  borrowerContact: loan.borrowerContact,
  quantity: loan.quantity,
  notes: loan.notes,
  lentAt: loan.lentAt.toISOString(),
  expectedReturnAt: loan.expectedReturnAt?.toISOString() ?? null,
  returnedAt: loan.returnedAt?.toISOString() ?? null,
  entityName: loan.entityName,
  createdAt: loan.createdAt.toISOString(),
  updatedAt: loan.updatedAt.toISOString()
});
