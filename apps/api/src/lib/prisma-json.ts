import type { Prisma } from "@prisma/client";

export const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
