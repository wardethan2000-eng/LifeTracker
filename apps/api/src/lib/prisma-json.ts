import type { Prisma } from "@prisma/client";

export const toInputJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export const parseTags = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((t): t is string => typeof t === "string");
};
