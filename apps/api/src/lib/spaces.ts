import type { Prisma, PrismaClient, SpaceType } from "@prisma/client";
import { customAlphabet } from "nanoid";
import { resolveAppBaseUrl } from "./asset-tags.js";

const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SCAN_TAG_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

type SpaceNodeRecord = {
  id: string;
  householdId: string;
  shortCode: string;
  scanTag: string;
  name: string;
  type: SpaceType;
  parentSpaceId: string | null;
  description: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  children?: SpaceNodeRecord[];
  breadcrumb?: Array<{ id: string; name: string; type: SpaceType }>;
  itemCount?: number;
  generalItemCount?: number;
  totalItemCount?: number;
};

const buildCodeGenerator = (length: number) => customAlphabet(SHORT_CODE_ALPHABET, length);
const buildScanTagGenerator = (length: number) => customAlphabet(SCAN_TAG_ALPHABET, length);

const sortSpaces = <T extends { sortOrder: number; name: string }>(spaces: T[]): T[] => spaces.sort((left, right) => {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name);
});

export const generateSpaceScanTag = async (prisma: PrismaLike): Promise<string> => {
  for (const length of [10, 12, 14, 16]) {
    const createCandidate = buildScanTagGenerator(length);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = `sp_${createCandidate()}`;
      const existing = await prisma.space.findUnique({
        where: { scanTag: candidate },
        select: { id: true }
      });

      if (!existing) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to generate a unique scan tag for the space.");
};

export const generateShortCode = async (prisma: PrismaLike, householdId: string): Promise<string> => {
  for (const length of [4, 5, 6]) {
    const createCandidate = buildCodeGenerator(length);

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const candidate = createCandidate();
      const existing = await prisma.space.findFirst({
        where: {
          householdId,
          shortCode: candidate
        },
        select: { id: true }
      });

      if (!existing) {
        return candidate;
      }
    }
  }

  throw new Error(`Unable to generate a unique short code for household '${householdId}'.`);
};

export const ensureSpaceScanTag = async (prisma: PrismaLike, spaceId: string): Promise<string> => {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { id: true, scanTag: true }
  });

  if (!space) {
    throw new Error(`Space '${spaceId}' was not found.`);
  }

  if (space.scanTag) {
    return space.scanTag;
  }

  const scanTag = await generateSpaceScanTag(prisma);
  await prisma.space.update({
    where: { id: spaceId },
    data: { scanTag }
  });

  return scanTag;
};

export const buildSpaceScanUrl = (scanTag: string): string => new URL(
  `/scan/s/${encodeURIComponent(scanTag)}`,
  `${resolveAppBaseUrl()}/`
).toString();

export const getSpaceBreadcrumb = async (
  prisma: PrismaLike,
  spaceId: string
): Promise<Array<{ id: string; name: string; type: SpaceType }>> => {
  const breadcrumb: Array<{ id: string; name: string; type: SpaceType }> = [];
  const visited = new Set<string>();
  let currentSpaceId: string | null = spaceId;

  while (currentSpaceId) {
    if (visited.has(currentSpaceId)) {
      throw new Error(`Circular space hierarchy detected at '${currentSpaceId}'.`);
    }

    visited.add(currentSpaceId);

    const space: { id: string; name: string; type: SpaceType; parentSpaceId: string | null } | null = await prisma.space.findUnique({
      where: { id: currentSpaceId },
      select: {
        id: true,
        name: true,
        type: true,
        parentSpaceId: true
      }
    });

    if (!space) {
      break;
    }

    breadcrumb.unshift({
      id: space.id,
      name: space.name,
      type: space.type
    });

    currentSpaceId = space.parentSpaceId;
  }

  return breadcrumb;
};

export const getSpaceTree = async (prisma: PrismaLike, householdId: string): Promise<SpaceNodeRecord[]> => {
  const spaces = await prisma.space.findMany({
    where: {
      householdId,
      deletedAt: null
    },
    include: {
      spaceItems: {
        select: { id: true }
      },
      generalItems: {
        where: { deletedAt: null },
        select: { id: true }
      }
    },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" }
    ]
  });

  const byId = new Map<string, SpaceNodeRecord>();

  for (const space of spaces) {
    const itemCount = space.spaceItems.length;
    const generalItemCount = space.generalItems.length;

    byId.set(space.id, {
      id: space.id,
      householdId: space.householdId,
      shortCode: space.shortCode,
      scanTag: space.scanTag,
      name: space.name,
      type: space.type,
      parentSpaceId: space.parentSpaceId,
      description: space.description,
      notes: space.notes,
      sortOrder: space.sortOrder,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
      deletedAt: space.deletedAt,
      children: [],
      breadcrumb: [],
      itemCount,
      generalItemCount,
      totalItemCount: itemCount + generalItemCount
    });
  }

  const roots: SpaceNodeRecord[] = [];

  for (const space of byId.values()) {
    if (space.parentSpaceId) {
      const parent = byId.get(space.parentSpaceId);

      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(space);
        continue;
      }
    }

    roots.push(space);
  }

  const assignBreadcrumbs = (
    nodes: SpaceNodeRecord[],
    ancestors: Array<{ id: string; name: string; type: SpaceType }>
  ): void => {
    for (const node of sortSpaces(nodes)) {
      const nextBreadcrumb = [...ancestors, { id: node.id, name: node.name, type: node.type }];
      node.breadcrumb = nextBreadcrumb;

      if (node.children && node.children.length > 0) {
        assignBreadcrumbs(node.children, nextBreadcrumb);
      }
    }
  };

  assignBreadcrumbs(roots, []);

  return sortSpaces(roots);
};