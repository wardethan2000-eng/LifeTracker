import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A full Prisma client or an active transaction context.
 * Use this type for function parameters that accept either.
 */
export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
