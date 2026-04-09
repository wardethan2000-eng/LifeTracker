# Aegis — Hobby Tracker Feature Implementation Specification

This document is the complete implementation reference for the Hobby Tracker feature. It is broken into sequential phases designed to be executed one at a time using GitHub Copilot Agent mode (Claude Sonnet 4). Each phase builds on the previous and must be completed before moving to the next.

The Hobby Tracker introduces a new top-level domain for ongoing hobby practices — activities with no completion state that accumulate history indefinitely. Unlike assets (things you maintain against decay) or projects (work with a finite arc), a hobby is a persistent workspace for a recurring practice like brewing beer, gardening, woodworking, or 3D printing.

---

## Guiding principles

- All changes are additive and non-breaking. Nothing in the existing asset, project, or inventory systems changes behavior.
- Inventory is universal. Hobby supplies live in household inventory and are linked into hobby workspaces via joining tables, not duplicated.
- Inventory gains a type distinction (consumable vs equipment) that benefits the entire platform, not just hobbies.
- Hobbies get first-class navigation alongside Dashboard, Assets, Projects, Inventory, and Maintenance.
- Recipes are deep. Typed ingredient slots link to inventory, steps have timers and types, and computed metrics (ABV, cost) can be derived from recipe inputs.
- Sessions support both simple binary status (active/completed) and configurable multi-step pipelines defined per hobby preset.
- Presets are domain-expert quality. The beer brewing preset alone should make a real brewer feel this tool was built for them.

---

## Phase 1 — Inventory Evolution

**Goal:** Add `itemType` and `conditionStatus` to the existing `InventoryItem` model. Update the web UI to differentiate consumables from equipment. This is a platform-wide improvement that benefits assets, projects, and the upcoming hobby domain equally.

**Why first:** The hobby domain depends on typed inventory. Shipping this independently keeps the diff small and testable before the larger hobby schema lands.

### 1.1 Prisma schema changes

Open `apps/api/prisma/schema.prisma`.

Add a new enum after the existing enums block:

```
enum InventoryItemType {
  consumable
  equipment
}
```

Modify the `InventoryItem` model. Add two new fields after the `householdId` field:

```
itemType           InventoryItemType       @default(consumable)
conditionStatus    String?
```

The `conditionStatus` field is a nullable string rather than an enum because different contexts may use different condition vocabularies. Suggested values are `good`, `fair`, `needs_repair`, `needs_replacement`, but the field is intentionally freeform. Equipment items use it; consumable items ignore it.

Add a new index on the model:

```
@@index([householdId, itemType])
```

After editing the schema, run `pnpm db:generate` then create a migration with `pnpm db:migrate --name add_inventory_item_type`.

### 1.2 Zod schema and type updates

Open `packages/types/src/index.ts`.

Add a new enum schema near the other enum schemas:

```typescript
export const inventoryItemTypeSchema = z.enum(["consumable", "equipment"]);
export type InventoryItemType = z.infer<typeof inventoryItemTypeSchema>;
```

Add a condition status schema:

```typescript
export const inventoryConditionStatusSchema = z.enum(["good", "fair", "needs_repair", "needs_replacement"]).nullable().optional();
```

Find the existing `inventoryItemSummarySchema` (or whatever the response schema is named for inventory items). Add both new fields to it:

```typescript
itemType: inventoryItemTypeSchema,
conditionStatus: z.string().nullable(),
```

Find the existing create input schema for inventory items. Add:

```typescript
itemType: inventoryItemTypeSchema.default("consumable"),
conditionStatus: z.string().max(40).nullable().optional(),
```

Find the existing update input schema for inventory items. Add both fields as optional:

```typescript
itemType: inventoryItemTypeSchema.optional(),
conditionStatus: z.string().max(40).nullable().optional(),
```

### 1.3 API route updates

Open `apps/api/src/routes/households/inventory-items.ts`.

In the create endpoint, pass `itemType` and `conditionStatus` from the validated input into the `prisma.inventoryItem.create` data object.

In the update endpoint, include both fields in the update data when present.

In all response serializer functions (`toInventoryItemSummaryResponse`, `toLowStockInventoryItemResponse`, and any others), include both new fields.

In the list endpoint, add an optional `itemType` query parameter that filters by item type when provided. Add it to the query schema and the Prisma `where` clause.

In the low-stock endpoint, only return items where `itemType` is `consumable`. Equipment items should never appear in the reorder watchlist because they are not consumable.

### 1.4 Web API client updates

Open `apps/web/lib/api.ts`.

Update the `getHouseholdInventory` options type to accept an optional `itemType` string filter parameter. Pass it as a query parameter when present.

### 1.5 Web UI updates

Open `apps/web/app/inventory/page.tsx`.

Add a filter toggle or tab bar near the top of the page body that allows switching between "All", "Consumables", and "Equipment". This should be a client component or use search params to drive the filter. When the equipment filter is active, the Reorder Watchlist section is hidden because equipment items do not have reorder semantics.

For equipment items displayed in the inventory groups table, replace the "Reorder Rule" column content with the condition status value (or "No condition set" if null). Replace the "On Hand" column label contextually — for equipment, show quantity as "Count" rather than "On Hand" since "3 on hand" sounds wrong for equipment but "3 units" is fine.

Open `apps/web/components/inventory-section.tsx`.

In the Add Inventory Item form, add an item type selector — a radio group or small toggle at the top with two options: "Consumable (supplies, ingredients, parts)" and "Equipment (tools, instruments, gear)". Default to consumable.

When "Equipment" is selected, conditionally show a condition status dropdown with options: Good, Fair, Needs Repair, Needs Replacement. When "Equipment" is selected, hide or visually de-emphasize the reorder threshold and reorder quantity fields since they are rarely relevant for equipment.

Open `apps/web/components/inventory-item-edit-form.tsx`.

Add the same item type selector and conditional field visibility. Preserve the current item type on load.

### 1.6 CSS

Open `apps/web/app/globals.css`.

Add any styles needed for the item type toggle and the filter bar. Follow existing patterns — use `var(--ink)`, `var(--surface)`, `var(--accent)`, `var(--border)`. No new CSS frameworks or modules.

### 1.7 Seed data

Open `apps/api/prisma/seed.ts`.

If inventory items are seeded, update a few existing seed items to use `itemType: "equipment"` and set a `conditionStatus` on them. Add one or two new equipment-type seed items (e.g., "Digital Multimeter", "Cordless Drill") to demonstrate the distinction.

---

## Phase 2 — Hobby Domain Prisma Schema

**Goal:** Add all new Prisma models for the hobby domain. No API routes or UI yet — just the data foundation. This phase produces a clean migration that can be verified by inspecting the generated SQL.

### 2.1 New enums

Add to `apps/api/prisma/schema.prisma`:

```
enum HobbyStatus {
  active
  paused
  archived
}

enum HobbySessionLifecycleMode {
  binary
  pipeline
}

enum HobbyRecipeSourceType {
  preset
  user
  imported
}

enum HobbyLogType {
  note
  tasting
  progress
  issue
}
```

### 2.2 Hobby model

This is the top-level workspace container. Add after the Project-related models:

```prisma
model Hobby {
  id               String                   @id @default(cuid())
  householdId      String
  name             String
  description      String?
  status           HobbyStatus              @default(active)
  hobbyType        String?
  lifecycleMode    HobbySessionLifecycleMode @default(binary)
  customFields     Json                     @default("{}")
  fieldDefinitions Json                     @default("[]")
  notes            String?
  createdById      String
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt
  household        Household                @relation(fields: [householdId], references: [id], onDelete: Cascade)
  createdBy        User                     @relation("HobbyCreator", fields: [createdById], references: [id], onDelete: Restrict)
  recipes          HobbyRecipe[]
  sessions         HobbySession[]
  metricDefinitions HobbyMetricDefinition[]
  statusPipeline   HobbySessionStatusStep[]
  logs             HobbyLog[]
  assetLinks       HobbyAsset[]
  inventoryLinks   HobbyInventoryItem[]
  projectLinks     HobbyProject[]
  inventoryCategories HobbyInventoryCategory[]

  @@index([householdId, status])
  @@index([createdById])
}
```

The `hobbyType` field stores the preset key (e.g., `beer-brewing`, `gardening`) when a hobby is created from a preset. The `lifecycleMode` field determines whether sessions use simple binary status or the configurable pipeline. The `fieldDefinitions` and `customFields` JSONB columns follow the same pattern used by assets.

### 2.3 Hobby linking tables

These follow the exact pattern of `ProjectAsset` and `ProjectInventoryItem`.

```prisma
model HobbyAsset {
  id          String   @id @default(cuid())
  hobbyId     String
  assetId     String
  role        String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  hobby       Hobby    @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  asset       Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([hobbyId, assetId])
  @@index([hobbyId])
  @@index([assetId])
}

model HobbyInventoryItem {
  id              String        @id @default(cuid())
  hobbyId         String
  inventoryItemId String
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  hobby           Hobby         @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)

  @@unique([hobbyId, inventoryItemId])
  @@index([hobbyId])
  @@index([inventoryItemId])
}

model HobbyProject {
  id        String   @id @default(cuid())
  hobbyId   String
  projectId String
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  hobby     Hobby    @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([hobbyId, projectId])
  @@index([hobbyId])
  @@index([projectId])
}

model HobbyInventoryCategory {
  id           String   @id @default(cuid())
  hobbyId      String
  categoryName String
  sortOrder    Int?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  hobby        Hobby    @relation(fields: [hobbyId], references: [id], onDelete: Cascade)

  @@unique([hobbyId, categoryName])
  @@index([hobbyId])
}
```

### 2.4 Session status pipeline

This model defines the ordered status steps when a hobby uses pipeline mode. Presets seed these; users can also customize them.

```prisma
model HobbySessionStatusStep {
  id        String   @id @default(cuid())
  hobbyId   String
  label     String
  sortOrder Int
  color     String?
  isFinal   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  hobby     Hobby    @relation(fields: [hobbyId], references: [id], onDelete: Cascade)

  @@index([hobbyId, sortOrder])
}
```

### 2.5 Recipe models

```prisma
model HobbyRecipe {
  id                String                 @id @default(cuid())
  hobbyId           String
  name              String
  description       String?
  sourceType        HobbyRecipeSourceType  @default(user)
  styleCategory     String?
  customFields      Json                   @default("{}")
  estimatedDuration String?
  estimatedCost     Float?
  yield             String?
  notes             String?
  isArchived        Boolean                @default(false)
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
  hobby             Hobby                  @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  ingredients       HobbyRecipeIngredient[]
  steps             HobbyRecipeStep[]
  sessions          HobbySession[]

  @@index([hobbyId])
  @@index([hobbyId, isArchived])
}

model HobbyRecipeIngredient {
  id              String        @id @default(cuid())
  recipeId        String
  inventoryItemId String?
  name            String
  quantity        Float
  unit            String
  category        String?
  notes           String?
  sortOrder       Int           @default(0)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  recipe          HobbyRecipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  inventoryItem   InventoryItem? @relation(fields: [inventoryItemId], references: [id], onDelete: SetNull)
  sessionIngredients HobbySessionIngredient[]

  @@index([recipeId, sortOrder])
  @@index([inventoryItemId])
}

model HobbyRecipeStep {
  id              String      @id @default(cuid())
  recipeId        String
  title           String
  description     String?
  sortOrder       Int         @default(0)
  durationMinutes Int?
  stepType        String      @default("generic")
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  recipe          HobbyRecipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  sessionSteps    HobbySessionStep[]

  @@index([recipeId, sortOrder])
}
```

The `stepType` field on `HobbyRecipeStep` is a freeform string rather than an enum because step types vary by hobby. Brewing uses mash, boil, ferment, condition, package. Woodworking uses cut, assemble, finish. The hobby preset seeds meaningful values; the UI can render type-specific icons or labels based on known strings but must gracefully handle unknown ones.

The `customFields` JSONB column on `HobbyRecipe` stores domain-specific data that varies by hobby type. For brewing: target OG, FG, ABV, IBU, SRM, mash temperature, boil duration, fermentation temperature range, carbonation level, BJCP style code. For woodworking: wood species, finish type, joinery method. The recipe editor renders these fields based on field definitions from the hobby preset.

### 2.6 Session models

```prisma
model HobbySession {
  id              String       @id @default(cuid())
  hobbyId         String
  recipeId        String?
  name            String
  status          String       @default("active")
  startDate       DateTime?
  completedDate   DateTime?
  pipelineStepId  String?
  customFields    Json         @default("{}")
  totalCost       Float?
  rating          Int?
  notes           String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  hobby           Hobby        @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  recipe          HobbyRecipe? @relation(fields: [recipeId], references: [id], onDelete: SetNull)
  ingredients     HobbySessionIngredient[]
  steps           HobbySessionStep[]
  metricReadings  HobbyMetricReading[]
  logs            HobbyLog[]

  @@index([hobbyId, status])
  @@index([hobbyId, createdAt])
  @@index([recipeId])
}

model HobbySessionIngredient {
  id                   String                 @id @default(cuid())
  sessionId            String
  recipeIngredientId   String?
  inventoryItemId      String?
  name                 String
  quantityUsed         Float
  unit                 String
  unitCost             Float?
  notes                String?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  session              HobbySession           @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  recipeIngredient     HobbyRecipeIngredient? @relation(fields: [recipeIngredientId], references: [id], onDelete: SetNull)
  inventoryItem        InventoryItem?         @relation(fields: [inventoryItemId], references: [id], onDelete: SetNull)

  @@index([sessionId])
  @@index([inventoryItemId])
}

model HobbySessionStep {
  id            String          @id @default(cuid())
  sessionId     String
  recipeStepId  String?
  title         String
  description   String?
  sortOrder     Int             @default(0)
  isCompleted   Boolean         @default(false)
  completedAt   DateTime?
  durationMinutes Int?
  notes         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  session       HobbySession    @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  recipeStep    HobbyRecipeStep? @relation(fields: [recipeStepId], references: [id], onDelete: SetNull)

  @@index([sessionId, sortOrder])
}
```

The `status` field on `HobbySession` is a string rather than an enum. When the hobby uses binary mode, the only valid values are `active` and `completed`. When the hobby uses pipeline mode, the valid values are the labels from `HobbySessionStatusStep`. The `pipelineStepId` field stores the current step ID when in pipeline mode, providing a foreign-key-based reference in addition to the denormalized status string.

### 2.7 Metric models

```prisma
model HobbyMetricDefinition {
  id          String               @id @default(cuid())
  hobbyId     String
  name        String
  unit        String
  description String?
  metricType  String               @default("numeric")
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  hobby       Hobby                @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  readings    HobbyMetricReading[]

  @@unique([hobbyId, name])
  @@index([hobbyId])
}

model HobbyMetricReading {
  id                   String                @id @default(cuid())
  metricDefinitionId   String
  sessionId            String?
  value                Float
  readingDate          DateTime
  notes                String?
  createdAt            DateTime              @default(now())
  metricDefinition     HobbyMetricDefinition @relation(fields: [metricDefinitionId], references: [id], onDelete: Cascade)
  session              HobbySession?         @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([metricDefinitionId, readingDate])
  @@index([sessionId])
}
```

The `metricType` field uses known values like `numeric`, `temperature`, `gravity`, `percentage`, `count`, `ph` but is a freeform string for extensibility. The UI can render type-specific formatting and input helpers (e.g., a gravity reading might show both SG and Plato) based on known types.

### 2.8 Hobby log model

```prisma
model HobbyLog {
  id        String       @id @default(cuid())
  hobbyId   String
  sessionId String?
  title     String?
  content   String
  logDate   DateTime
  logType   HobbyLogType @default(note)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  hobby     Hobby        @relation(fields: [hobbyId], references: [id], onDelete: Cascade)
  session   HobbySession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([hobbyId, logDate])
  @@index([sessionId])
}
```

### 2.9 Relation additions to existing models

Add the following reverse relation fields to existing models. These are the `hobby` side of each linking table.

On the `Household` model, add:

```
hobbies Hobby[]
```

On the `User` model, add:

```
createdHobbies Hobby[] @relation("HobbyCreator")
```

On the `Asset` model, add:

```
hobbyLinks HobbyAsset[]
```

On the `InventoryItem` model, add:

```
hobbyLinks          HobbyInventoryItem[]
hobbyRecipeIngredients HobbyRecipeIngredient[]
hobbySessionIngredients HobbySessionIngredient[]
```

On the `Project` model, add:

```
hobbyLinks HobbyProject[]
```

### 2.10 Migration

After all schema edits, run:

```
pnpm db:generate
pnpm db:migrate --name add_hobby_domain
```

Verify the generated migration SQL creates all expected tables, enums, indexes, and foreign keys. Do not proceed to Phase 3 until the migration applies cleanly.

---

## Phase 3 — Hobby Domain Zod Schemas and TypeScript Types

**Goal:** Define all Zod schemas and exported TypeScript types in `packages/types/src/index.ts` for the hobby domain. These are consumed by both the API routes (request validation) and the web client (response parsing).

### 3.1 Enum schemas

```typescript
export const hobbyStatusSchema = z.enum(["active", "paused", "archived"]);
export type HobbyStatus = z.infer<typeof hobbyStatusSchema>;

export const hobbySessionLifecycleModeSchema = z.enum(["binary", "pipeline"]);
export type HobbySessionLifecycleMode = z.infer<typeof hobbySessionLifecycleModeSchema>;

export const hobbyRecipeSourceTypeSchema = z.enum(["preset", "user", "imported"]);
export type HobbyRecipeSourceType = z.infer<typeof hobbyRecipeSourceTypeSchema>;

export const hobbyLogTypeSchema = z.enum(["note", "tasting", "progress", "issue"]);
export type HobbyLogType = z.infer<typeof hobbyLogTypeSchema>;
```

### 3.2 Hobby response and input schemas

Define these following the exact patterns used by `projectSchema`, `createProjectInputSchema`, and `updateProjectInputSchema` in the existing types file. Each response schema should include all fields from the Prisma model serialized as strings for dates and with nullable fields typed appropriately. Each create input schema should include required fields and optional fields with defaults. Each update input schema should make all fields optional via `.partial()` or individual `.optional()` annotations.

Models that need full schema sets (response + create input + update input):

- Hobby
- HobbyRecipe
- HobbyRecipeIngredient
- HobbyRecipeStep
- HobbySession
- HobbySessionIngredient
- HobbySessionStep
- HobbyMetricDefinition
- HobbyMetricReading
- HobbyLog
- HobbySessionStatusStep
- HobbyAsset (link table — create input has hobbyId + assetId + optional fields)
- HobbyInventoryItem (link table)
- HobbyProject (link table)
- HobbyInventoryCategory

For list endpoints, define array wrapper schemas as needed (e.g., `hobbyListSchema = z.array(hobbySchema)`).

### 3.3 Hobby summary schema

Define a `hobbySummarySchema` for the list view that includes computed summary fields:

```typescript
export const hobbySummarySchema = hobbySchema.extend({
  recipeCount: z.number(),
  sessionCount: z.number(),
  activeSessionCount: z.number(),
  completedSessionCount: z.number(),
  linkedAssetCount: z.number(),
  linkedInventoryCount: z.number(),
});
export type HobbySummary = z.infer<typeof hobbySummarySchema>;
```

### 3.4 Session summary schema

Define a `hobbySessionSummarySchema` that includes aggregated data:

```typescript
export const hobbySessionSummarySchema = hobbySessionSchema.extend({
  ingredientCount: z.number(),
  stepCount: z.number(),
  completedStepCount: z.number(),
  metricReadingCount: z.number(),
  logCount: z.number(),
  recipeName: z.string().nullable(),
});
export type HobbySessionSummary = z.infer<typeof hobbySessionSummarySchema>;
```

### 3.5 Recipe detail schema

For the recipe detail view which includes nested ingredients and steps:

```typescript
export const hobbyRecipeDetailSchema = hobbyRecipeSchema.extend({
  ingredients: z.array(hobbyRecipeIngredientSchema),
  steps: z.array(hobbyRecipeStepSchema),
  sessionCount: z.number(),
});
export type HobbyRecipeDetail = z.infer<typeof hobbyRecipeDetailSchema>;
```

### 3.6 Shopping list schema

For generating a shopping list from a recipe by diffing against inventory:

```typescript
export const hobbyRecipeShoppingListItemSchema = z.object({
  ingredientId: z.string(),
  ingredientName: z.string(),
  quantityNeeded: z.number(),
  quantityOnHand: z.number(),
  deficit: z.number(),
  unit: z.string(),
  inventoryItemId: z.string().nullable(),
  estimatedCost: z.number().nullable(),
});
export type HobbyRecipeShoppingListItem = z.infer<typeof hobbyRecipeShoppingListItemSchema>;

export const hobbyRecipeShoppingListSchema = z.object({
  recipeId: z.string(),
  recipeName: z.string(),
  items: z.array(hobbyRecipeShoppingListItemSchema),
  totalEstimatedCost: z.number().nullable(),
});
export type HobbyRecipeShoppingList = z.infer<typeof hobbyRecipeShoppingListSchema>;
```

---

## Phase 4 — Hobby API Routes

**Goal:** Implement all REST API endpoints for the hobby domain. Follow existing route conventions exactly: Fastify plugin exports, household membership checks, activity logging, search index syncing, ISO date serialization.

### 4.1 File structure

Create the following new route files:

- `apps/api/src/routes/hobbies/index.ts` — Hobby CRUD, listing, and top-level operations
- `apps/api/src/routes/hobbies/recipes.ts` — Recipe CRUD with nested ingredients and steps
- `apps/api/src/routes/hobbies/sessions.ts` — Session CRUD with nested ingredients, steps, and status transitions
- `apps/api/src/routes/hobbies/metrics.ts` — Metric definitions and readings
- `apps/api/src/routes/hobbies/logs.ts` — Hobby journal/log entries
- `apps/api/src/routes/hobbies/links.ts` — Asset, inventory, and project linking/unlinking
- `apps/api/src/routes/hobbies/shopping-list.ts` — Recipe-to-shopping-list generation

Create a helper file:

- `apps/api/src/lib/hobby-access.ts` — `getAccessibleHobby()` function following the pattern of `getAccessibleAsset()` in `apps/api/src/lib/asset-access.ts`. Accepts prisma client, hobby ID, and user ID. Returns the hobby if the user is a member of the hobby's household, otherwise null.

Register all new route files in the main app router (wherever existing route plugins like projects are registered).

### 4.2 Hobby CRUD endpoints

Base path: `/v1/households/:householdId/hobbies`

**GET /v1/households/:householdId/hobbies** — List hobbies for a household. Supports optional query params: `status` (filter by hobby status), `search` (name search), `limit`, `cursor`. Returns array of `HobbySummary` objects with computed counts.

**POST /v1/households/:householdId/hobbies** — Create a new hobby. Body follows `createHobbyInputSchema`. The handler should:
1. Validate household membership.
2. Create the hobby record.
3. If `hobbyType` is provided and matches a known preset key, seed the hobby's `fieldDefinitions`, `customFields`, metric definitions, status pipeline steps, and inventory categories from the preset. (The preset application logic should be a dedicated helper function in `apps/api/src/lib/hobby-presets.ts` following the pattern of `apps/api/src/lib/presets.ts`.)
4. Call `logActivity()` with action `hobby_created`.
5. Call `syncToSearchIndex` for the new hobby.
6. Return the created hobby.

**GET /v1/households/:householdId/hobbies/:hobbyId** — Get a single hobby with full detail including linked assets, linked inventory items, metric definitions, status pipeline steps, inventory categories, recent sessions (limit 5), and recipe count.

**PATCH /v1/households/:householdId/hobbies/:hobbyId** — Update hobby fields. Body follows `updateHobbyInputSchema`. Log activity. Re-sync search index.

**DELETE /v1/households/:householdId/hobbies/:hobbyId** — Soft delete or hard delete (decide based on existing project deletion behavior — if projects use hard delete, hobbies should too). Log activity. Remove from search index.

### 4.3 Recipe CRUD endpoints

Base path: `/v1/households/:householdId/hobbies/:hobbyId/recipes`

**GET .../recipes** — List recipes for a hobby. Supports `isArchived` filter and `search`. Returns array of recipe summaries with ingredient count, step count, and session count.

**POST .../recipes** — Create a recipe. Body includes recipe fields plus optional `ingredients` array and `steps` array for bulk creation in a single request. Use a Prisma transaction to create the recipe and all nested records atomically. Log activity.

**GET .../recipes/:recipeId** — Get a recipe with full detail: all ingredients (with inventory item data if linked) and all steps ordered by sortOrder. Include session count.

**PATCH .../recipes/:recipeId** — Update recipe fields. Does not modify nested ingredients or steps (those have their own endpoints).

**DELETE .../recipes/:recipeId** — Delete a recipe. Sessions that reference it should have their `recipeId` set to null (the Prisma schema uses `onDelete: SetNull`). Log activity.

**POST .../recipes/:recipeId/ingredients** — Add an ingredient to a recipe.

**PATCH .../recipes/:recipeId/ingredients/:ingredientId** — Update an ingredient.

**DELETE .../recipes/:recipeId/ingredients/:ingredientId** — Remove an ingredient.

**POST .../recipes/:recipeId/steps** — Add a step. Auto-assign sortOrder to end if not provided.

**PATCH .../recipes/:recipeId/steps/:stepId** — Update a step.

**DELETE .../recipes/:recipeId/steps/:stepId** — Remove a step.

**POST .../recipes/:recipeId/reorder-steps** — Bulk reorder steps. Body is an ordered array of step IDs. Update sortOrder values in a transaction.

### 4.4 Session CRUD endpoints

Base path: `/v1/households/:householdId/hobbies/:hobbyId/sessions`

**GET .../sessions** — List sessions. Supports `status` filter, `recipeId` filter, `limit`, `cursor`. Returns `HobbySessionSummary` objects.

**POST .../sessions** — Create a session. If `recipeId` is provided, the handler should:
1. Load the recipe with its ingredients and steps.
2. Clone all recipe ingredients into `HobbySessionIngredient` records (preserving the `recipeIngredientId` link and copying the `inventoryItemId`).
3. Clone all recipe steps into `HobbySessionStep` records (preserving the `recipeStepId` link).
4. Copy recipe `customFields` into the session's `customFields` as starting values.
5. If the hobby is in pipeline mode, set `status` to the first pipeline step's label and set `pipelineStepId` to the first step's ID.

If no recipe is provided, create a blank session with the provided name and status.

Log activity.

**GET .../sessions/:sessionId** — Full session detail: all ingredients (with inventory links), all steps, metric readings, and logs.

**PATCH .../sessions/:sessionId** — Update session fields. If `status` is being changed and the hobby is in pipeline mode, validate that the new status matches a valid pipeline step label. If the new status is a final step (isFinal = true), automatically set `completedDate` to now. Log activity.

**POST .../sessions/:sessionId/advance** — Advance a pipeline session to the next status step. Looks up current `pipelineStepId`, finds the next step by sortOrder, updates both `pipelineStepId` and `status`. If advancing to a final step, set `completedDate`. Return the updated session. This endpoint only works when the hobby is in pipeline mode.

**DELETE .../sessions/:sessionId** — Delete a session and all nested records. Log activity.

**POST .../sessions/:sessionId/ingredients** — Add an ingredient to a session. If `inventoryItemId` is provided, create an `InventoryTransaction` of type `consume` that decrements the inventory item's quantity by `quantityUsed`. Use the existing `applyInventoryTransaction` helper from `apps/api/src/lib/inventory.ts`.

**PATCH .../sessions/:sessionId/ingredients/:ingredientId** — Update a session ingredient. If quantity changes and an inventory item is linked, create a corrective inventory transaction (the difference between old and new quantity).

**DELETE .../sessions/:sessionId/ingredients/:ingredientId** — Remove an ingredient. If it had an inventory link, create a restock transaction to return the consumed quantity.

**POST .../sessions/:sessionId/steps** — Add a step.

**PATCH .../sessions/:sessionId/steps/:stepId** — Update a step. When `isCompleted` transitions to true, set `completedAt` to now.

**POST .../sessions/:sessionId/steps/reorder** — Bulk reorder steps.

### 4.5 Metric endpoints

Base path: `/v1/households/:householdId/hobbies/:hobbyId/metrics`

**GET .../metrics** — List metric definitions for a hobby.

**POST .../metrics** — Create a metric definition.

**PATCH .../metrics/:metricId** — Update a metric definition.

**DELETE .../metrics/:metricId** — Delete a metric definition and all its readings.

**GET .../metrics/:metricId/readings** — List readings for a metric. Supports `sessionId` filter, date range filter, `limit`, `cursor`. Ordered by `readingDate` descending.

**POST .../metrics/:metricId/readings** — Record a new metric reading. Body includes `value`, `readingDate`, optional `sessionId`, optional `notes`.

**DELETE .../metrics/:metricId/readings/:readingId** — Delete a reading.

### 4.6 Log/journal endpoints

Base path: `/v1/households/:householdId/hobbies/:hobbyId/logs`

**GET .../logs** — List log entries. Supports `sessionId` filter, `logType` filter, date range, `limit`, `cursor`. Ordered by `logDate` descending.

**POST .../logs** — Create a log entry.

**PATCH .../logs/:logId** — Update a log entry.

**DELETE .../logs/:logId** — Delete a log entry.

### 4.7 Link management endpoints

Base path: `/v1/households/:householdId/hobbies/:hobbyId/links`

**GET .../links/assets** — List linked assets with basic asset info (name, category).

**POST .../links/assets** — Link an asset. Body: `{ assetId, role?, notes? }`.

**DELETE .../links/assets/:hobbyAssetId** — Unlink an asset.

**GET .../links/inventory** — List linked inventory items with current stock info.

**POST .../links/inventory** — Link an inventory item. Body: `{ inventoryItemId, notes? }`.

**DELETE .../links/inventory/:hobbyInventoryItemId** — Unlink an inventory item.

**GET .../links/projects** — List linked projects with basic project info.

**POST .../links/projects** — Link a project. Body: `{ projectId, notes? }`.

**DELETE .../links/projects/:hobbyProjectId** — Unlink a project.

**GET .../links/inventory-categories** — List hobby inventory categories.

**POST .../links/inventory-categories** — Add a category. Body: `{ categoryName, sortOrder? }`.

**DELETE .../links/inventory-categories/:categoryId** — Remove a category.

### 4.8 Shopping list endpoint

**GET /v1/households/:householdId/hobbies/:hobbyId/recipes/:recipeId/shopping-list** — Generate a shopping list from a recipe. For each recipe ingredient that has an `inventoryItemId`, look up the current `quantityOnHand` on the inventory item. Compute the deficit (recipe quantity minus on-hand quantity, floored at zero). For ingredients without an inventory link, include them with `quantityOnHand: 0` and `deficit` equal to the full recipe quantity. Compute `estimatedCost` as deficit multiplied by the inventory item's `unitCost` when available. Return a `HobbyRecipeShoppingList` response.

### 4.9 Hobby presets helper

Create `apps/api/src/lib/hobby-presets.ts`.

This file defines the hobby preset data structures and the `applyHobbyPreset` function. Unlike asset presets which live in `packages/presets`, hobby presets will also live in a new file `packages/presets/src/hobby-library.ts` (created in Phase 6). The helper function in the API accepts a preset definition and a hobby ID, then seeds:

1. `fieldDefinitions` and `customFields` defaults on the hobby record.
2. `HobbyMetricDefinition` records for each metric in the preset.
3. `HobbySessionStatusStep` records for the pipeline (if the preset defines one).
4. `HobbyInventoryCategory` records for suggested inventory categories.
5. Optionally, starter `HobbyRecipe` records with ingredients and steps if the preset includes them.

Follow the transactional pattern used in `applyPresetToAsset` in `apps/api/src/lib/presets.ts`.

### 4.10 Search index and activity logging

In `apps/api/src/lib/search-index.ts`, add a `syncHobbyToSearchIndex` function following the pattern of `syncAssetToSearchIndex`. Index the hobby name, description, and hobby type. Hobby sessions and recipes do not need to be independently indexed in Phase 4 — searching for the hobby name is sufficient initially.

In `apps/api/src/lib/activity-log.ts`, add hobby-related action types: `hobby_created`, `hobby_updated`, `hobby_deleted`, `hobby_recipe_created`, `hobby_session_created`, `hobby_session_completed`, `hobby_session_advanced`. Follow the existing string-based action type pattern.

---

## Phase 5 — Web API Client Methods

**Goal:** Add all API client methods to `apps/web/lib/api.ts` for the hobby domain. Follow the existing pattern exactly: typed functions that call `apiRequest` with a path and a Zod schema for response parsing.

Add methods for every endpoint defined in Phase 4. Group them together in the file under a `// ── Hobbies ──` section comment, following the convention used for `// ── Projects ──` and `// ── Inventory ──` sections.

Key methods include:

- `getHouseholdHobbies(householdId, options?)` — returns paginated hobby summaries
- `createHobby(householdId, input)` — creates a hobby
- `getHobby(householdId, hobbyId)` — returns full hobby detail
- `updateHobby(householdId, hobbyId, input)` — updates a hobby
- `deleteHobby(householdId, hobbyId)` — deletes a hobby
- `getHobbyRecipes(householdId, hobbyId, options?)` — lists recipes
- `createHobbyRecipe(householdId, hobbyId, input)` — creates a recipe with nested ingredients/steps
- `getHobbyRecipe(householdId, hobbyId, recipeId)` — returns recipe detail
- `updateHobbyRecipe(householdId, hobbyId, recipeId, input)` — updates recipe
- `deleteHobbyRecipe(householdId, hobbyId, recipeId)` — deletes recipe
- `createHobbyRecipeIngredient(householdId, hobbyId, recipeId, input)` — adds ingredient
- `updateHobbyRecipeIngredient(...)` — updates ingredient
- `deleteHobbyRecipeIngredient(...)` — removes ingredient
- `createHobbyRecipeStep(...)` — adds step
- `updateHobbyRecipeStep(...)` — updates step
- `deleteHobbyRecipeStep(...)` — removes step
- `reorderHobbyRecipeSteps(householdId, hobbyId, recipeId, stepIds)` — reorders steps
- `getHobbySessions(householdId, hobbyId, options?)` — lists sessions
- `createHobbySession(householdId, hobbyId, input)` — creates session (optionally from recipe)
- `getHobbySession(householdId, hobbyId, sessionId)` — returns session detail
- `updateHobbySession(...)` — updates session
- `advanceHobbySession(householdId, hobbyId, sessionId)` — advances pipeline status
- `deleteHobbySession(...)` — deletes session
- `createHobbySessionIngredient(...)` — adds ingredient with inventory consumption
- `updateHobbySessionIngredient(...)` — updates ingredient
- `deleteHobbySessionIngredient(...)` — removes ingredient with inventory restoration
- `createHobbySessionStep(...)` / `updateHobbySessionStep(...)` / `deleteHobbySessionStep(...)`
- `getHobbyMetrics(householdId, hobbyId)` — lists metric definitions
- `createHobbyMetric(...)` / `updateHobbyMetric(...)` / `deleteHobbyMetric(...)`
- `getHobbyMetricReadings(householdId, hobbyId, metricId, options?)` — lists readings
- `createHobbyMetricReading(...)` / `deleteHobbyMetricReading(...)`
- `getHobbyLogs(householdId, hobbyId, options?)` — lists log entries
- `createHobbyLog(...)` / `updateHobbyLog(...)` / `deleteHobbyLog(...)`
- `getHobbyAssets(householdId, hobbyId)` — linked assets
- `linkHobbyAsset(...)` / `unlinkHobbyAsset(...)`
- `getHobbyInventory(householdId, hobbyId)` — linked inventory
- `linkHobbyInventory(...)` / `unlinkHobbyInventory(...)`
- `getHobbyProjects(householdId, hobbyId)` — linked projects
- `linkHobbyProject(...)` / `unlinkHobbyProject(...)`
- `getHobbyInventoryCategories(householdId, hobbyId)` — inventory categories
- `createHobbyInventoryCategory(...)` / `deleteHobbyInventoryCategory(...)`
- `getHobbyRecipeShoppingList(householdId, hobbyId, recipeId)` — shopping list from recipe

---

## Phase 6 — Hobby Preset Library (Beer Brewing)

**Goal:** Create the hobby preset infrastructure in `packages/presets` and implement the beer brewing preset as the flagship example. This preset should be deep enough that a real homebrewer would find it genuinely useful.

### 6.1 Hobby preset types

In `packages/types/src/index.ts`, add:

```typescript
export const hobbyPresetMetricTemplateSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(40),
  metricType: z.string().max(40).default("numeric"),
  description: z.string().max(500).optional(),
});
export type HobbyPresetMetricTemplate = z.infer<typeof hobbyPresetMetricTemplateSchema>;

export const hobbyPresetPipelineStepSchema = z.object({
  label: z.string().min(1).max(80),
  sortOrder: z.number().int().min(0),
  color: z.string().max(20).optional(),
  isFinal: z.boolean().default(false),
});
export type HobbyPresetPipelineStep = z.infer<typeof hobbyPresetPipelineStepSchema>;

export const hobbyPresetRecipeFieldSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  type: z.string(),
  helpText: z.string().max(500).optional(),
  unit: z.string().max(40).optional(),
  group: z.string().max(80).optional(),
  options: z.array(z.string()).default([]),
});
export type HobbyPresetRecipeField = z.infer<typeof hobbyPresetRecipeFieldSchema>;

export const hobbyPresetRecipeTemplateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  styleCategory: z.string().optional(),
  ingredients: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
    category: z.string().optional(),
    notes: z.string().optional(),
  })),
  steps: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    durationMinutes: z.number().optional(),
    stepType: z.string().default("generic"),
  })),
  customFields: z.record(z.unknown()).default({}),
});
export type HobbyPresetRecipeTemplate = z.infer<typeof hobbyPresetRecipeTemplateSchema>;

export const hobbyPresetSchema = z.object({
  key: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  lifecycleMode: hobbySessionLifecycleModeSchema.default("binary"),
  tags: z.array(z.string()),
  suggestedCustomFields: z.array(presetCustomFieldTemplateSchema),
  metricTemplates: z.array(hobbyPresetMetricTemplateSchema),
  pipelineSteps: z.array(hobbyPresetPipelineStepSchema).default([]),
  inventoryCategories: z.array(z.string()),
  recipeFields: z.array(hobbyPresetRecipeFieldSchema).default([]),
  starterRecipes: z.array(hobbyPresetRecipeTemplateSchema).default([]),
  suggestedEquipment: z.array(z.string()).default([]),
  sessionStepTypes: z.array(z.string()).default([]),
});
export type HobbyPreset = z.infer<typeof hobbyPresetSchema>;
```

### 6.2 Hobby preset helpers

Create `packages/presets/src/hobby-library.ts`.

Define helper functions following the pattern of `libraryPreset`, `schedule`, `metric`, `field` in `packages/presets/src/library.ts`:

```typescript
const hobbyPreset = (input: HobbyPreset): HobbyPreset => ({ ...input });
const hobbyMetric = (input: HobbyPresetMetricTemplate): HobbyPresetMetricTemplate => ({ metricType: "numeric", ...input });
const pipelineStep = (label: string, sortOrder: number, options?: { color?: string; isFinal?: boolean }): HobbyPresetPipelineStep => ({
  label, sortOrder, color: options?.color, isFinal: options?.isFinal ?? false
});
const recipeField = (input: HobbyPresetRecipeField): HobbyPresetRecipeField => ({ options: [], ...input });
```

Export the array as `hobbyPresetLibrary`.

### 6.3 Beer brewing preset

This is the flagship preset. It should include:

**Hobby custom fields:**
- `brewingMethod` — select: All-Grain, Extract, BIAB (Brew in a Bag), Partial Mash
- `defaultBatchSize` — number, unit: gallons
- `fermentationVesselType` — select: Bucket, Carboy, Conical, Unitank
- `carbonationMethod` — select: Bottle Conditioning, Forced (Keg), Natural
- `waterSource` — select: Municipal, Well, Spring, RO/Distilled
- `brewhouse` — string, help text: "Name or location of your brewing setup"

**Lifecycle mode:** pipeline

**Pipeline steps (sortOrder, color, isFinal):**
1. Planned (0, gray, false)
2. Brew Day (1, blue, false)
3. Primary Fermentation (2, amber, false)
4. Secondary / Dry Hop (3, amber, false)
5. Cold Crash / Clarification (4, cyan, false)
6. Packaging (5, green, false)
7. Conditioning / Carbonating (6, green, false)
8. Ready / Aging (7, teal, false)
9. Completed (8, green, true)

**Metric definitions:**
- Original Gravity (OG) — unit: SG, metricType: gravity
- Final Gravity (FG) — unit: SG, metricType: gravity
- pH — unit: pH, metricType: ph
- Fermentation Temperature — unit: °F, metricType: temperature
- Batch Volume — unit: gal, metricType: numeric
- Pre-Boil Gravity — unit: SG, metricType: gravity
- Mash Temperature — unit: °F, metricType: temperature

**Inventory categories:**
- Base Malts
- Specialty Malts
- Hops
- Yeast
- Adjuncts & Sugars
- Water Chemistry
- Fining Agents
- Priming Sugar
- Sanitizer & Cleaning
- Bottling / Kegging Supplies

**Recipe fields** (these define the custom fields available on recipe `customFields`):
- `bjcpStyle` — string, group: Style, help: "e.g. 10A - American Pale Ale"
- `targetOG` — number, unit: SG, group: Targets
- `targetFG` — number, unit: SG, group: Targets
- `targetABV` — number, unit: %, group: Targets
- `targetIBU` — number, unit: IBU, group: Targets
- `targetSRM` — number, unit: SRM, group: Targets
- `mashTemp` — number, unit: °F, group: Process
- `mashDuration` — number, unit: min, group: Process
- `boilDuration` — number, unit: min, group: Process
- `fermTempLow` — number, unit: °F, group: Process
- `fermTempHigh` — number, unit: °F, group: Process
- `carbonationLevel` — number, unit: volumes CO2, group: Packaging
- `waterProfile` — string, group: Water, help: "Target water chemistry or style (e.g., Burton, Pilsen)"

**Suggested equipment** (list of strings the UI can suggest as assets to link):
- Brew Kettle
- Mash Tun
- Hot Liquor Tank
- Fermenter (Primary)
- Fermenter (Secondary)
- Keg System
- Bottle Filler / Capper
- Wort Chiller
- Temperature Controller
- Hydrometer / Refractometer
- pH Meter
- Grain Mill
- Auto-Siphon / Transfer Pump
- CO2 Tank & Regulator
- Cleaning Bucket / Spray

**Session step types:** mash, boil, chill, pitch, ferment, dry-hop, cold-crash, package, condition

**Starter recipe (American Pale Ale):**

Include one complete starter recipe to demonstrate the recipe structure:

Name: "Simple American Pale Ale"
Style category: "10A - American Pale Ale"
Ingredients (all as freeform with suggested categories):
- 9 lb Pale Malt (2-Row), category: Base Malts
- 1 lb Crystal 40L, category: Specialty Malts
- 0.5 lb Munich Malt, category: Specialty Malts
- 1 oz Cascade (60 min), category: Hops
- 1 oz Cascade (15 min), category: Hops
- 1 oz Cascade (0 min / flameout), category: Hops
- 1 packet US-05 / Safale American Ale Yeast, category: Yeast
- 1 tsp Irish Moss (15 min), category: Fining Agents
- 5 oz Priming Sugar (if bottling), category: Priming Sugar

Steps:
1. Heat Strike Water — "Heat 4 gallons to 164°F for a target mash temp of 152°F." — stepType: mash, duration: 15
2. Mash In — "Add grain to strike water, stir to eliminate dough balls. Hold at 152°F." — stepType: mash, duration: 60
3. Mash Out — "Raise to 168°F and hold for 10 minutes to halt enzymatic activity." — stepType: mash, duration: 10
4. Sparge — "Batch sparge or fly sparge with 170°F water to collect ~6.5 gallons." — stepType: mash, duration: 20
5. Bring to Boil — "Bring wort to a rolling boil. Watch for hot break." — stepType: boil, duration: 10
6. 60-Minute Hop Addition — "Add 1 oz Cascade. Start 60-minute boil timer." — stepType: boil, duration: 45
7. 15-Minute Additions — "Add 1 oz Cascade and 1 tsp Irish Moss with 15 minutes remaining." — stepType: boil, duration: 15
8. Flameout Hops — "Kill heat. Add 1 oz Cascade at flameout. Steep 10 minutes." — stepType: boil, duration: 10
9. Chill Wort — "Chill to 66°F as quickly as possible using wort chiller." — stepType: chill, duration: 20
10. Transfer & Pitch Yeast — "Transfer to fermenter, leaving trub behind. Aerate well. Pitch yeast." — stepType: pitch, duration: 15
11. Primary Fermentation — "Ferment at 64–68°F for 10–14 days until activity slows and gravity is stable." — stepType: ferment, duration: null
12. Package — "Bottle with priming sugar or keg and force carbonate to 2.4 volumes CO2." — stepType: package, duration: 30
13. Condition — "Bottle condition 2 weeks at room temp, or keg condition 3–5 days cold." — stepType: condition, duration: null

Custom fields for this recipe:
```json
{
  "bjcpStyle": "10A - American Pale Ale",
  "targetOG": 1.052,
  "targetFG": 1.012,
  "targetABV": 5.2,
  "targetIBU": 40,
  "targetSRM": 7,
  "mashTemp": 152,
  "mashDuration": 60,
  "boilDuration": 60,
  "fermTempLow": 64,
  "fermTempHigh": 68,
  "carbonationLevel": 2.4,
  "waterProfile": "Balanced"
}
```

### 6.4 Export and registration

Export `hobbyPresetLibrary` from the `@aegis/presets` package. Update `packages/presets/src/index.ts` (or create it if it does not exist) to re-export from both `library.ts` (asset presets) and `hobby-library.ts` (hobby presets).

In the API hobby preset helper (`apps/api/src/lib/hobby-presets.ts`), import `hobbyPresetLibrary` from `@aegis/presets` and implement the lookup and application logic.

---

## Phase 7 — Web UI: Hobby List Page

**Goal:** Build the `/hobbies` page as a reading surface following the same layout patterns as `/projects`. This is the entry point to the hobby domain.

### 7.1 Navigation

Open the `AppShell` component (likely `apps/web/components/app-shell.tsx`). Add a "Hobbies" navigation item between "Projects" and "Inventory" in the sidebar. Use a consistent icon style. The active path should be `/hobbies`.

### 7.2 Page route

Create `apps/web/app/hobbies/page.tsx`.

This is a server component. It fetches the current user via `getMe()`, resolves the household, then calls `getHouseholdHobbies(householdId)`.

Layout follows the reading surface pattern used by `/projects`:

1. **Page header** — `<h1>Hobbies</h1>` with a subtitle. Action button: "New Hobby" linking to `/hobbies/new`.
2. **Stats row** — Active hobbies count, total sessions count, active sessions count, recipes count. Use the `.stats-row` and `.stat-card` classes.
3. **Hobby cards** — Each hobby renders as a panel with: hobby name, description (truncated), status badge, hobby type badge (if from a preset), session summary (e.g., "12 sessions · 3 active"), recipe count, linked equipment count. Cards link to `/hobbies/[hobbyId]`.
4. **Empty state** — When no hobbies exist, show a `.panel__empty` message encouraging the user to create their first hobby.

### 7.3 Create hobby page

Create `apps/web/app/hobbies/new/page.tsx`.

This is a workbench surface (flat form paradigm). Follow the pattern of `apps/web/app/assets/new/page.tsx` — server component that renders the form workbench.

Create `apps/web/components/hobby-workbench.tsx` as a client component.

The workbench contains:

**Core Identity section** (`.workbench-section`):
- Hobby Name (required text input)
- Description (textarea)
- Hobby Type selector — a select dropdown listing available hobby presets from the library. When a preset is selected, populate the description from the preset, show the preset description as helper text, and enable a "What this preset includes" expandable section showing metric count, pipeline steps, inventory categories, recipe fields, and suggested equipment.
- Status — defaults to Active. Select with Active / Paused / Archived options.
- Session Lifecycle — radio toggle: "Simple (Active / Completed)" vs "Pipeline (Multi-step workflow)". When a preset is selected that defines pipeline mode, auto-select Pipeline. Show the pipeline step names when Pipeline is selected.

**Submit action** — calls `createHobby` API method. On success, redirect to `/hobbies/[hobbyId]`.

---

## Phase 8 — Web UI: Hobby Detail Page

**Goal:** Build the `/hobbies/[hobbyId]` page as the primary hobby workspace. This is the most complex UI surface in the hobby domain and uses a tabbed layout to organize sub-sections.

### 8.1 Page route

Create `apps/web/app/hobbies/[hobbyId]/page.tsx`.

Server component. Fetches hobby detail, recipes, sessions, metrics, logs, linked assets, and linked inventory. Accepts a `tab` search parameter to control which tab is active (default: `overview`).

### 8.2 Tab structure

The page uses a horizontal tab bar below the page header. Tabs:

1. **Overview** — Summary dashboard with stats, recent sessions, active session status, quick actions.
2. **Recipes** — Recipe list with create/edit/view capabilities.
3. **Sessions** — Session list with filtering, creation from recipe, and status management.
4. **Inventory** — Filtered view of household inventory linked to this hobby, grouped by hobby inventory categories. Equipment section and consumables section.
5. **Metrics** — Metric definitions with reading history charts or tables.
6. **Journal** — Chronological log entries with type filtering.
7. **Settings** — Edit hobby details, manage pipeline steps, manage linked assets/projects, danger zone (archive/delete).

### 8.3 Overview tab

Layout: two-column `.resource-layout`.

**Primary column:**
- Stats row: total sessions, active sessions, completed sessions, recipes, linked equipment count.
- Active Sessions panel — if any sessions are in a non-completed status, show them as cards with status badge, pipeline progress (if pipeline mode), and quick-advance button. If pipeline mode, show a visual step indicator (a horizontal bar with step labels, current step highlighted).
- Recent Sessions panel — last 5 completed sessions with date, recipe name, rating (if set), and brief notes preview.

**Aside column:**
- Hobby Info card — status badge, hobby type badge, lifecycle mode, created date.
- Equipment card — list of linked assets with names and condition status. "Link Equipment" button.
- Quick Actions card — "Start New Session", "Add Recipe", "Record Metric Reading", "Write Journal Entry".

### 8.4 Recipes tab

Single column layout.

- Recipe list as cards or a table. Each entry shows: name, style category, ingredient count, step count, times used (session count), estimated cost. Action buttons: View, Edit, Start Session from Recipe, Shopping List.
- "New Recipe" button opens the recipe creation form.
- Recipe creation/editing should be a workbench surface (could be an inline form or a dedicated `/hobbies/[hobbyId]/recipes/new` page — follow whichever pattern projects use for phase creation).
- Recipe detail view shows ingredients table (name, quantity, unit, category, linked inventory item name), steps list (ordered, with step type badges and duration), and the recipe's custom fields rendered based on the hobby preset's `recipeFields` definitions.
- Shopping List button triggers a fetch to the shopping list endpoint and renders a table showing: ingredient name, needed quantity, on-hand quantity, deficit, estimated cost. Total estimated cost at the bottom.

### 8.5 Sessions tab

Single column layout with filter bar.

- Filter bar: status filter (all / active / completed), recipe filter (select from hobby's recipes), date range.
- Session list as cards. Each card shows: name, recipe name (if from recipe), status badge (with pipeline step indicator if pipeline mode), start date, completed date (if done), rating (if set), ingredient count, step progress (e.g., "7/13 steps done").
- "New Session" button — opens a create form where user provides a name, optionally selects a recipe (which pre-populates ingredients and steps), and optionally sets a start date.
- "Start from Recipe" shortcut — available on each recipe card in the Recipes tab. Creates a session pre-populated from that recipe and navigates to the session detail.

### 8.6 Session detail

Create `apps/web/app/hobbies/[hobbyId]/sessions/[sessionId]/page.tsx`.

This is a working surface with a two-column resource layout.

**Primary column:**

- If pipeline mode: pipeline status indicator at the top — a horizontal step bar showing all pipeline steps with the current step highlighted. "Advance" button to move to the next step. "Mark Completed" button if on the final step.
- If binary mode: status toggle (Active / Completed) with completion date.
- Steps section — ordered checklist of session steps. Each step has a checkbox, title, step type badge, description (expandable), duration indicator, completion timestamp, and notes field. Steps can be checked off individually.
- Ingredients section — table showing ingredient name, quantity used, unit, unit cost, linked inventory item (with current stock level), and notes. "Add Ingredient" button. Each row is editable or deletable.
- Metric Readings section — for each metric definition on the hobby, show a "Record Reading" form (date, value, notes) and a mini-history of recent readings for this session. If there are enough readings, render a small sparkline or simple chart.

**Aside column:**

- Session Info card — status, start date, completed date, total cost (sum of ingredient costs), rating (editable star or numeric input), recipe link (if from recipe).
- Notes card — editable textarea for session-level notes.
- Journal Entries card — log entries scoped to this session, with "Add Entry" button. Shows recent entries with type badges.

### 8.7 Inventory tab

Two-section layout.

**Equipment section** — table of linked inventory items where `itemType` is `equipment`. Columns: name, condition status, linked asset (if the inventory item is also linked as an asset), notes. This is a gear checklist — a quick view of whether you have all your equipment and what condition it is in.

**Consumables section** — grouped by hobby inventory categories. For each category, a table of linked inventory items where `itemType` is `consumable`. Columns: name, on hand, unit, reorder status, last price, supplier. This mirrors the household inventory table but filtered to just hobby-relevant items.

At the bottom: "Link Inventory Item" button (opens a picker that searches household inventory) and "Manage Categories" (add/remove inventory categories).

### 8.8 Metrics tab

Layout: one card per metric definition.

Each metric card contains:
- Metric name and unit in the header.
- "Record Reading" inline form (date, value, notes, optional session selector).
- Reading history table — date, value, session name (if scoped), notes. Ordered by date descending. Paginated or "Load More".
- If 3+ readings exist, show a simple line chart (could use a lightweight chart or just an SVG sparkline).

### 8.9 Journal tab

Single column. Chronological feed.

- Filter bar: log type filter (all / note / tasting / progress / issue), session filter, date range.
- Log entries rendered as cards: title (if set), content, date, type badge, session link (if scoped to a session).
- "New Entry" form at the top: title, content (textarea), date (defaults to today), type selector, optional session selector.

### 8.10 Settings tab

Workbench surface (flat form paradigm).

**Primary column:**
- Core Identity section — edit name, description, status, hobby type (read-only if from preset), lifecycle mode.
- Pipeline Steps section (visible when lifecycle mode is pipeline) — ordered list of steps with inline edit for label and color. Add/remove/reorder steps.
- Inventory Categories section — list of category names with add/remove.
- Custom Fields section — field definition editor following the asset workbench pattern.

**Aside column:**
- Linked Assets card — list with add/remove.
- Linked Projects card — list with add/remove.
- Danger Zone card — archive/unarchive hobby, permanently delete hobby (with confirmation).

---

## Phase 9 — CSS for Hobby UI

**Goal:** Add all CSS needed for the hobby domain to `apps/web/app/globals.css`. Follow existing conventions.

### 9.1 New styles needed

- **Pipeline step indicator** — a horizontal bar component showing ordered steps with the current step highlighted. Use `var(--accent)` for the active step, `var(--success)` for completed steps, `var(--border)` for upcoming steps. Each step is a small labeled segment.
- **Hobby tab bar** — horizontal tab navigation below the page header. Style with `var(--border)` bottom border, `var(--accent)` for active tab indicator.
- **Recipe card** — similar to existing panel cards but with ingredient/step count badges.
- **Session card** — similar to project task cards with status badges and step progress indicators.
- **Metric reading mini-chart** — minimal styling for inline sparklines.
- **Journal entry card** — simple card with type-colored left border (note: `var(--ink-muted)`, tasting: `var(--accent)`, progress: `var(--success)`, issue: `var(--warning)`).
- **Shopping list table** — highlight deficit rows where deficit > 0 using `var(--warning)` background tint.
- **Step checklist** — checkbox list with step type badges, expandable description, and completion timestamps.

Use only existing CSS custom properties. Do not introduce new CSS frameworks, modules, or preprocessors. All new styles go in `globals.css` under a `/* ── Hobbies ──────────── */` section comment.

---

## Phase 10 — Seed Data

**Goal:** Update `apps/api/prisma/seed.ts` to include demo hobby data for development and testing.

Create a "Beer Brewing" hobby attached to the default seed household. Apply the beer-brewing preset. Seed the following:

1. The hobby record with the preset applied (field definitions, custom fields, metrics, pipeline steps, inventory categories).
2. The starter "Simple American Pale Ale" recipe from the preset, with all ingredients and steps.
3. One additional user-created recipe — "Oatmeal Stout" with appropriate ingredients and steps.
4. 3 seed sessions:
   - One completed session ("Batch #1 — APA") based on the APA recipe, with all steps completed, several metric readings (OG, FG, fermentation temp), two journal entries (brew day notes and tasting notes), and ingredient consumption records.
   - One active session ("Batch #2 — Oatmeal Stout") based on the stout recipe, in the "Primary Fermentation" pipeline step, with brew day steps completed and an OG reading recorded.
   - One planned session ("Batch #3 — West Coast IPA") with no recipe link, just a name and planned status.
5. Seed 5–8 inventory items in brewing-related categories (2-Row Pale Malt, Cascade Hops, US-05 Yeast, Crystal 40L, Irish Moss, Star San, Priming Sugar, Flaked Oats). Mix of consumable and equipment types. Link them to the hobby.
6. Link one household asset (if a brew-kettle-type asset exists in seed data) to the hobby as equipment.

Make the seed data idempotent — check for existing records before creating, following the pattern used by the existing seed script.

---

## Future preset candidates (not implemented in this specification)

The following hobby presets should be built after the beer brewing preset is validated and the UI is stable. Each would follow the same pattern as Phase 6 with hobby-specific custom fields, metrics, pipeline steps, inventory categories, recipe fields, and starter recipes.

- **Gardening** — seasonal planting schedules, soil amendment tracking, harvest logs, pest/disease journal, zone/bed mapping, yield metrics
- **3D Printing** — print job sessions, filament spool inventory with weight tracking, printer settings as recipe fields, success/failure logging
- **Woodworking** — project-per-piece sessions, lumber inventory (board feet), cut lists as recipe steps, finish cure timelines
- **Reloading (Ammunition)** — load data cards as recipes, component inventory (brass, bullets, powder, primers), velocity/accuracy metrics
- **Candle/Soap Making** — batch recipes similar to brewing, fragrance/wax inventory, cure time tracking
- **Fishing** — trip sessions, tackle inventory, catch logs with species/size metrics, location tracking
- **Sewing/Quilting** — pattern library as recipes, fabric/notion inventory, project-per-piece sessions
- **Cooking (serious hobbyist)** — recipe library, pantry inventory, cost-per-serving tracking, iteration logging

---

## Implementation checklist summary

| Phase | Scope | Key deliverables |
|-------|-------|-----------------|
| 1 | Inventory Evolution | `itemType` enum, `conditionStatus` field, UI filter/toggle, equipment vs consumable display |
| 2 | Prisma Schema | ~15 new models, 4 new enums, relation additions to existing models, migration |
| 3 | Zod/Types | All response, create, update, list, and detail schemas for hobby domain |
| 4 | API Routes | 7 route files, ~40 endpoints, hobby preset helper, search index, activity logging |
| 5 | Web API Client | ~45 typed API client methods in `apps/web/lib/api.ts` |
| 6 | Preset Library | Hobby preset type system, helper functions, complete beer brewing preset |
| 7 | Hobby List UI | `/hobbies` page, `/hobbies/new` workbench, navigation update |
| 8 | Hobby Detail UI | `/hobbies/[hobbyId]` tabbed workspace with 7 tabs, session detail page |
| 9 | CSS | Pipeline indicator, tab bar, recipe/session/journal cards, shopping list, step checklist |
| 10 | Seed Data | Demo brewing hobby with recipes, sessions, metrics, journal, inventory |
