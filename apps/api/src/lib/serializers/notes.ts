import { noteFolderSchema, noteTemplateSchema } from "@lifekeeper/types";
import { parseTags } from "../prisma-json.js";

const parseFlags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === "string");
  return [];
};

type NoteFolderRecord = {
  id: string;
  householdId: string;
  parentFolderId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

type NoteFolderWithCounts = NoteFolderRecord & {
  _count: {
    entries: number;
    children: number;
  };
};

type NoteTemplateRecord = {
  id: string;
  householdId: string;
  name: string;
  description: string | null;
  bodyTemplate: string;
  entryType: string;
  defaultTags: unknown;
  defaultFlags: unknown;
  isBuiltIn: boolean;
  sortOrder: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export const toNoteFolderResponse = (folder: NoteFolderRecord) => noteFolderSchema.parse({
  id: folder.id,
  householdId: folder.householdId,
  parentFolderId: folder.parentFolderId,
  name: folder.name,
  color: folder.color,
  icon: folder.icon,
  sortOrder: folder.sortOrder,
  createdById: folder.createdById,
  createdAt: folder.createdAt.toISOString(),
  updatedAt: folder.updatedAt.toISOString()
});

export const toNoteFolderWithCountsResponse = (folder: NoteFolderWithCounts) => ({
  ...toNoteFolderResponse(folder),
  entryCount: folder._count.entries,
  childCount: folder._count.children
});

export const toNoteTemplateResponse = (template: NoteTemplateRecord) => noteTemplateSchema.parse({
  id: template.id,
  householdId: template.householdId,
  name: template.name,
  description: template.description,
  bodyTemplate: template.bodyTemplate,
  entryType: template.entryType,
  defaultTags: parseTags(template.defaultTags),
  defaultFlags: parseFlags(template.defaultFlags),
  isBuiltIn: template.isBuiltIn,
  sortOrder: template.sortOrder,
  createdById: template.createdById,
  createdAt: template.createdAt.toISOString(),
  updatedAt: template.updatedAt.toISOString()
});
