# Aegis — Ideas Feature Phase 1: Schema, Types, and API

This document is the complete implementation reference for Phase 1 of the Ideas feature. It covers the Prisma schema, Zod types, API serializers, and API routes. No frontend work in this phase.

**Execution model:** This prompt is designed for GitHub Copilot Agent mode. Read the entire document before writing any code. All changes must be additive and non-breaking. Do not modify the behavior of any existing route, component, or schema field.

**Current state:** A localStorage-only prototype exists in the frontend (`apps/web/components/idea-list.tsx`, `apps/web/components/idea-workbench.tsx`, and pages at `apps/web/app/(dashboard)/ideas/`). This prototype stores ideas in the browser with no backend persistence. Phase 1 builds the real backend. Phase 2 (a separate prompt) will refactor the frontend to use it.

---

## Guiding principles

- Ideas are a lightweight staging area. They are simpler than projects, assets, or hobbies. Resist the urge to over-engineer them.
- Ideas belong to a household, just like projects, assets, and hobbies. They follow the same access control pattern (household membership check).
- An idea can be promoted to a Project, Asset, or Hobby. When promoted, the idea is archived (not deleted) and linked to the entity it became. Demotion works in reverse — a stalled project can be sent back to an idea.
- Ideas have a Kanban lifecycle: Spark → Developing → Ready. This is modeled as an enum, not a freeform string.
- Ideas support appended notes (a log, not a single text field), bookmarked links, a materials list, and a steps checklist. These are stored as JSON columns for simplicity — they do not need their own models.
- Activity logging and search indexing follow existing patterns.

---

## 1.1 Prisma schema changes

Open `apps/api/prisma/schema.prisma`.

### New enums

Add these enums after the existing enum block (near the other status/type enums):

```prisma
// Kanban lifecycle stage for an idea.
enum IdeaStage {
  spark       // Just captured — a raw thought
  developing  // Being fleshed out with notes, links, materials
  ready       // Mature enough to promote into a project, asset, or hobby
}

// What an idea can be promoted into.
enum IdeaPromotionTarget {
  project
  asset
  hobby
}

// Priority level for triaging ideas.
enum IdeaPriority {
  low
  medium
  high
}

// Category grouping for ideas.
enum IdeaCategory {
  home_improvement
  vehicle
  outdoor
  technology
  hobby_craft
  financial
  health
  travel
  learning
  other
}
```

### New model

Add the `Idea` model after the existing `Hobby`-related models (before the `Comment` model):

```prisma
// A lightweight staging area for thoughts that may eventually become projects, assets, or hobbies.
model Idea {
  id              String               @id @default(cuid())
  householdId     String
  title           String
  description     String?
  stage           IdeaStage            @default(spark)
  priority        IdeaPriority         @default(medium)
  category        IdeaCategory?
  promotionTarget IdeaPromotionTarget?

  // Structured data stored as JSON for simplicity.
  // notes: Array of { id: string, text: string, createdAt: string }
  // links: Array of { id: string, url: string, label: string, createdAt: string }
  // materials: Array of { id: string, name: string, quantity: string, notes: string }
  // steps: Array of { id: string, label: string, done: boolean }
  notes           Json                 @default("[]")
  links           Json                 @default("[]")
  materials       Json                 @default("[]")
  steps           Json                 @default("[]")

  // Promotion tracking
  promotedAt      DateTime?
  promotedToType  IdeaPromotionTarget?
  promotedToId    String?              // ID of the created project/asset/hobby

  // Demotion tracking — when a project/asset/hobby is sent back to ideas
  demotedFromType IdeaPromotionTarget?
  demotedFromId   String?

  // Standard fields
  archivedAt      DateTime?
  createdById     String
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  household       Household            @relation(fields: [householdId], references: [id], onDelete: Cascade)
  createdBy       User                 @relation("IdeaCreator", fields: [createdById], references: [id], onDelete: Restrict)

  @@index([householdId, stage])
  @@index([householdId, category])
  @@index([householdId, priority])
  @@index([createdById])
}
```

### Update the `User` model

Add this relation field to the `User` model, in the block with the other `created*` relations:

```prisma
createdIdeas            Idea[]                @relation("IdeaCreator")
```

### Update the `Household` model

Add this relation field to the `Household` model, in the block with other relations:

```prisma
ideas                   Idea[]
```

### Update the `AttachmentEntityType` enum

Add `idea` to the `AttachmentEntityType` enum so attachments can be linked to ideas in the future:

```prisma
idea
```

### Update the `EntryEntityType` enum

Add `idea` to the `EntryEntityType` enum so universal entries can reference ideas:

```prisma
idea
```

### Update the `CommentEntityType` enum

Add `idea` to the `CommentEntityType` enum so comments can be posted on ideas:

```prisma
idea
```

After editing the schema, run:
```bash
pnpm db:generate
pnpm db:migrate --name add_idea_model
```

---

## 1.2 Zod schemas and TypeScript types

Open `packages/types/src/index.ts`.

Add the following schemas and types. Place them near the project/hobby schemas for logical grouping.

```typescript
// ── Idea enums ──────────────────────────────────────────────────────

export const ideaStageSchema = z.enum(["spark", "developing", "ready"]);
export type IdeaStage = z.infer<typeof ideaStageSchema>;

export const ideaPrioritySchema = z.enum(["low", "medium", "high"]);
export type IdeaPriority = z.infer<typeof ideaPrioritySchema>;

export const ideaCategorySchema = z.enum([
  "home_improvement",
  "vehicle",
  "outdoor",
  "technology",
  "hobby_craft",
  "financial",
  "health",
  "travel",
  "learning",
  "other",
]);
export type IdeaCategory = z.infer<typeof ideaCategorySchema>;

export const ideaPromotionTargetSchema = z.enum(["project", "asset", "hobby"]);
export type IdeaPromotionTarget = z.infer<typeof ideaPromotionTargetSchema>;

// ── Idea JSON sub-schemas ───────────────────────────────────────────

export const ideaNoteItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
});
export type IdeaNoteItem = z.infer<typeof ideaNoteItemSchema>;

export const ideaLinkItemSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  label: z.string(),
  createdAt: z.string(),
});
export type IdeaLinkItem = z.infer<typeof ideaLinkItemSchema>;

export const ideaMaterialItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.string(),
  notes: z.string(),
});
export type IdeaMaterialItem = z.infer<typeof ideaMaterialItemSchema>;

export const ideaStepItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
});
export type IdeaStepItem = z.infer<typeof ideaStepItemSchema>;

// ── Idea response schema ────────────────────────────────────────────

export const ideaSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  stage: ideaStageSchema,
  priority: ideaPrioritySchema,
  category: ideaCategorySchema.nullable(),
  promotionTarget: ideaPromotionTargetSchema.nullable(),
  notes: z.array(ideaNoteItemSchema),
  links: z.array(ideaLinkItemSchema),
  materials: z.array(ideaMaterialItemSchema),
  steps: z.array(ideaStepItemSchema),
  promotedAt: z.string().nullable(),
  promotedToType: ideaPromotionTargetSchema.nullable(),
  promotedToId: z.string().nullable(),
  demotedFromType: ideaPromotionTargetSchema.nullable(),
  demotedFromId: z.string().nullable(),
  archivedAt: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Idea = z.infer<typeof ideaSchema>;

export const ideaSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  stage: ideaStageSchema,
  priority: ideaPrioritySchema,
  category: ideaCategorySchema.nullable(),
  promotionTarget: ideaPromotionTargetSchema.nullable(),
  noteCount: z.number(),
  linkCount: z.number(),
  materialCount: z.number(),
  stepCount: z.number(),
  stepsCompleted: z.number(),
  promotedAt: z.string().nullable(),
  promotedToType: ideaPromotionTargetSchema.nullable(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IdeaSummary = z.infer<typeof ideaSummarySchema>;

// ── Idea input schemas ──────────────────────────────────────────────

export const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  stage: ideaStageSchema.optional(),
  priority: ideaPrioritySchema.optional(),
  category: ideaCategorySchema.optional(),
  promotionTarget: ideaPromotionTargetSchema.optional(),
  materials: z.array(z.object({
    name: z.string().min(1),
    quantity: z.string(),
    notes: z.string(),
  })).optional(),
  steps: z.array(z.object({
    label: z.string().min(1),
  })).optional(),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  stage: ideaStageSchema.optional(),
  priority: ideaPrioritySchema.optional(),
  category: ideaCategorySchema.nullable().optional(),
  promotionTarget: ideaPromotionTargetSchema.nullable().optional(),
  materials: z.array(ideaMaterialItemSchema).optional(),
  steps: z.array(ideaStepItemSchema).optional(),
  links: z.array(ideaLinkItemSchema).optional(),
});
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;

export const addIdeaNoteSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type AddIdeaNoteInput = z.infer<typeof addIdeaNoteSchema>;

export const addIdeaLinkSchema = z.object({
  url: z.string().url(),
  label: z.string().min(1).max(200),
});
export type AddIdeaLinkInput = z.infer<typeof addIdeaLinkSchema>;

export const promoteIdeaSchema = z.object({
  target: ideaPromotionTargetSchema,
  // Optional overrides for the new entity. The idea's title and description
  // are used as defaults if these are not provided.
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});
export type PromoteIdeaInput = z.infer<typeof promoteIdeaSchema>;

export const demoteToIdeaSchema = z.object({
  sourceType: ideaPromotionTargetSchema,
  sourceId: z.string(),
  // Optional overrides for the new idea
  title: z.string().min(1).max(200).optional(),
  stage: ideaStageSchema.optional(),
});
export type DemoteToIdeaInput = z.infer<typeof demoteToIdeaSchema>;
```

---

## 1.3 API serializers

Create a new file `apps/api/src/lib/serializers/ideas.ts`:

```typescript
import type { Idea as PrismaIdea } from "@prisma/client";

type IdeaNoteItem = { id: string; text: string; createdAt: string };
type IdeaStepItem = { id: string; label: string; done: boolean };

export function toIdeaResponse(idea: PrismaIdea) {
  const notes = (idea.notes as unknown as IdeaNoteItem[]) ?? [];
  const links = (idea.links as unknown as unknown[]) ?? [];
  const materials = (idea.materials as unknown as unknown[]) ?? [];
  const steps = (idea.steps as unknown as IdeaStepItem[]) ?? [];

  return {
    id: idea.id,
    householdId: idea.householdId,
    title: idea.title,
    description: idea.description,
    stage: idea.stage,
    priority: idea.priority,
    category: idea.category,
    promotionTarget: idea.promotionTarget,
    notes,
    links,
    materials,
    steps,
    promotedAt: idea.promotedAt?.toISOString() ?? null,
    promotedToType: idea.promotedToType,
    promotedToId: idea.promotedToId,
    demotedFromType: idea.demotedFromType,
    demotedFromId: idea.demotedFromId,
    archivedAt: idea.archivedAt?.toISOString() ?? null,
    createdById: idea.createdById,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
  };
}

export function toIdeaSummaryResponse(idea: PrismaIdea) {
  const notes = (idea.notes as unknown as IdeaNoteItem[]) ?? [];
  const links = (idea.links as unknown as unknown[]) ?? [];
  const materials = (idea.materials as unknown as unknown[]) ?? [];
  const steps = (idea.steps as unknown as IdeaStepItem[]) ?? [];

  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    stage: idea.stage,
    priority: idea.priority,
    category: idea.category,
    promotionTarget: idea.promotionTarget,
    noteCount: notes.length,
    linkCount: links.length,
    materialCount: materials.length,
    stepCount: steps.length,
    stepsCompleted: steps.filter((s) => s.done).length,
    promotedAt: idea.promotedAt?.toISOString() ?? null,
    promotedToType: idea.promotedToType,
    archivedAt: idea.archivedAt?.toISOString() ?? null,
    createdAt: idea.createdAt.toISOString(),
    updatedAt: idea.updatedAt.toISOString(),
  };
}
```

Then add the exports to `apps/api/src/lib/serializers/index.ts`:

```typescript
export { toIdeaResponse, toIdeaSummaryResponse } from "./ideas.js";
```

---

## 1.4 API routes

Create a new file `apps/api/src/routes/ideas/index.ts`.

Follow the exact same pattern used by `apps/api/src/routes/hobbies/index.ts` for route structure, membership checks, activity logging, and search indexing.

### Route overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/households/:householdId/ideas` | List ideas with filtering/pagination |
| POST | `/v1/households/:householdId/ideas` | Create a new idea |
| GET | `/v1/households/:householdId/ideas/:ideaId` | Get idea detail |
| PATCH | `/v1/households/:householdId/ideas/:ideaId` | Update an idea |
| DELETE | `/v1/households/:householdId/ideas/:ideaId` | Soft-delete (archive) an idea |
| POST | `/v1/households/:householdId/ideas/:ideaId/notes` | Append a note to the idea's notes log |
| DELETE | `/v1/households/:householdId/ideas/:ideaId/notes/:noteId` | Remove a note from the log |
| POST | `/v1/households/:householdId/ideas/:ideaId/links` | Add a bookmark link |
| DELETE | `/v1/households/:householdId/ideas/:ideaId/links/:linkId` | Remove a bookmark link |
| POST | `/v1/households/:householdId/ideas/:ideaId/promote` | Promote the idea into a project, asset, or hobby |
| POST | `/v1/households/:householdId/ideas/demote` | Demote a project/asset/hobby back to an idea |
| PATCH | `/v1/households/:householdId/ideas/:ideaId/stage` | Move idea to a different Kanban stage |

### Implementation details

**List ideas (GET):**
- Query params: `stage` (enum filter), `category` (enum filter), `priority` (enum filter), `search` (title substring), `includeArchived` (boolean, default false), `limit` (1-100, default 50), `cursor` (cuid for keyset pagination)
- Default filter: `archivedAt: null` unless `includeArchived` is true
- Order by: `updatedAt desc`
- Response: array of `IdeaSummary` objects + `nextCursor`

**Create idea (POST):**
- Accept `CreateIdeaInput` body
- Generate cuid IDs for each material and step item
- Set `done: false` for each step
- Log activity: `idea.created`
- Sync to search index with entity type `idea`

**Update idea (PATCH):**
- Accept `UpdateIdeaInput` body
- When updating `materials`, `steps`, or `links`, replace the entire array (the client manages the full list state)
- Log activity: `idea.updated`
- Re-sync search index

**Delete idea (DELETE):**
- Soft delete: set `archivedAt` to `now()`
- Log activity: `idea.archived`
- Remove from search index

**Append note (POST notes):**
- Accept `AddIdeaNoteInput` body
- Read existing notes JSON, append new note with generated cuid ID and ISO timestamp
- Update the idea record
- Log activity: `idea.note_added`

**Remove note (DELETE notes/:noteId):**
- Read existing notes JSON, filter out the note with matching ID
- Update the idea record

**Add link (POST links):**
- Accept `AddIdeaLinkInput` body
- Read existing links JSON, append new link with generated cuid ID and ISO timestamp
- Update the idea record
- Log activity: `idea.link_added`

**Remove link (DELETE links/:linkId):**
- Read existing links JSON, filter out the link with matching ID
- Update the idea record

**Move stage (PATCH stage):**
- Accept `{ stage: IdeaStage }` body
- Update the idea's stage
- Log activity: `idea.stage_changed`

**Promote idea (POST promote):**
- Accept `PromoteIdeaInput` body
- Based on `target`:
  - `project`: Create a new Project with `name` from the idea title (or override), `description` from the idea description (or override), `status: planning`. If the idea has `steps`, create them as ProjectTask records on the project.
  - `asset`: Create a new Asset with `name` from the idea title (or override), `description` from the idea description (or override), `category: other` (default).
  - `hobby`: Create a new Hobby with `name` from the idea title (or override), `description` from the idea description (or override), `status: active`.
- After creating the target entity, update the idea: set `promotedAt`, `promotedToType`, `promotedToId`, `archivedAt` to now, `stage` to `ready`.
- Log activity: `idea.promoted` with metadata `{ targetType, targetId }`
- Return the idea response plus the ID and type of the created entity

**Demote to idea (POST demote):**
- Accept `DemoteToIdeaInput` body
- Validate the source entity exists and belongs to the household
- Create a new Idea with:
  - `title` from the source entity's name (or override)
  - `description` from the source entity's description
  - `stage: developing` (or override)
  - `demotedFromType` and `demotedFromId` set to the source
- Do NOT delete or modify the source entity — the user decides what to do with it separately
- Log activity: `idea.demoted_from` with metadata `{ sourceType, sourceId }`
- Return the new idea response

### Register routes

In `apps/api/src/routes/` wherever routes are registered (look at how `hobbyRoutes` is registered in the main app file), register `ideaRoutes` the same way.

### Search index integration

In `apps/api/src/lib/search-index.ts`, add a `syncIdeaToSearchIndex` function following the same pattern as `syncHobbyToSearchIndex`. The searchable fields are `title` and `description`. Entity type is `idea`.

### Activity log integration

Use `logActivity()` from `apps/api/src/lib/activity-log.ts` with entity type `idea` for all mutating operations. Follow the same pattern used by hobby routes.

---

## 1.5 Seed data

Update `apps/api/prisma/seed.ts` to create 5-8 sample ideas across different stages, categories, and priorities. Include at least:

- One "spark" stage idea with just a title
- One "developing" idea with notes, links, and materials
- One "ready" idea with steps and a promotion target set
- One archived/promoted idea linked to an existing seeded project

Use the seeded household and user IDs that already exist in the seed file.

---

## Constraints and boundaries

- Do NOT modify any existing route, component, or schema field behavior.
- Do NOT install new dependencies. Everything needed is already available.
- Do NOT create frontend components or pages in this phase.
- Do NOT use `any` types. TypeScript strict mode is enforced.
- Do NOT hardcode user IDs or household IDs. Use env vars or seeded constants.
- All dates serialize as ISO strings in API responses.
- Error responses use `{ message: string }` format. Let the centralized error handler catch Zod and Prisma errors.
- Run `pnpm db:generate` after schema changes before writing code that uses new models.
