# Copilot Prompt — File Attachment Infrastructure

**Feature:** Polymorphic file attachments with S3-compatible object storage, pre-signed URL upload pipeline, attachment CRUD, reusable upload/gallery UI components, and integration into all relevant surfaces.

**Scope:** This is the complete first pass. It covers backend infrastructure (Prisma model, Fastify storage plugin, API routes), shared type contracts, web API client methods, reusable frontend components (uploader, gallery, lightbox), CSS, and integration into every surface where attachments are useful. It does NOT cover OCR text extraction, thumbnail generation, or cleanup workers for orphaned uploads — those are separate future passes.

**Execution model:** This prompt is designed for GitHub Copilot Agent mode (Claude Sonnet 4). Read the entire document before writing any code. All changes must be additive and non-breaking. Do not modify the behavior of any existing route, component, or schema field.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Dependencies](#3-dependencies)
4. [Prisma Schema Changes](#4-prisma-schema-changes)
5. [Fastify Storage Plugin](#5-fastify-storage-plugin)
6. [Zod Schemas and TypeScript Types](#6-zod-schemas-and-typescript-types)
7. [API Routes](#7-api-routes)
8. [Web API Client Methods](#8-web-api-client-methods)
9. [CSS for Attachment Components](#9-css-for-attachment-components)
10. [Reusable Frontend Components](#10-reusable-frontend-components)
11. [Surface Integrations](#11-surface-integrations)
12. [Server Actions](#12-server-actions)
13. [Constraints and Boundaries](#13-constraints-and-boundaries)

---

## 1. Architecture Overview

### Upload flow

Files never pass through the Fastify API. The upload uses a pre-signed URL pipeline:

1. The web client calls POST `/v1/households/:householdId/attachments/upload` with file metadata (filename, MIME type, size, entity reference).
2. The API validates the request, creates an `Attachment` record with status `pending`, generates a storage key, produces a pre-signed PUT URL using the S3 SDK, and returns the URL plus the attachment record to the client.
3. The client uploads the file directly to the object storage endpoint (MinIO locally, Cloudflare R2 or AWS S3 in production) using the pre-signed PUT URL via a standard `fetch` PUT request.
4. On upload completion, the client calls POST `/v1/households/:householdId/attachments/:attachmentId/confirm`.
5. The API verifies the file exists in the bucket via a HEAD request, flips the attachment status to `active`, and returns the confirmed record.

### Download flow

When the client needs to display or download a file, it calls GET `/v1/households/:householdId/attachments/:attachmentId/download`, which returns a short-lived pre-signed GET URL. The client uses this URL directly in `<img>` tags for images or opens it for document downloads. Pre-signed download URLs expire after the configured duration (default 1 hour).

### Storage key format

All objects are namespaced by household to enable future per-household access policies:

```
households/{householdId}/attachments/{attachmentId}/{sanitized_filename}
```

Sanitize filenames by replacing any character outside `[a-zA-Z0-9._-]` with underscores. Preserve the original filename in the database for display purposes.

### Polymorphic entity reference

The `Attachment` model uses a string-based `entityType` + `entityId` pair to reference any parent record. This is the same pattern used by `ActivityLog` (which has `entityType` + `entityId` string columns) and `InventoryTransaction` (which has `referenceType` + `referenceId`). There are no foreign keys on the polymorphic columns — referential integrity is enforced at the application layer during upload request validation.

### S3 API compatibility

The `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages speak the S3 protocol. MinIO, Cloudflare R2, and AWS S3 all implement this protocol. The only difference between environments is the endpoint URL and credentials in environment variables. The application code is identical across all three.

---

## 2. Environment Variables

Add these to `apps/api/.env.example` with MinIO local defaults. Add the same keys (without values) to any `.env.example` documentation:

```env
# ── Object Storage (S3-compatible) ────────────────────────────────
# Local development: MinIO at http://localhost:9000
# Production: Cloudflare R2 or AWS S3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=lifekeeper-attachments
S3_FORCE_PATH_STYLE=true
S3_PRESIGN_UPLOAD_EXPIRES_SECONDS=300
S3_PRESIGN_DOWNLOAD_EXPIRES_SECONDS=3600
```

`S3_FORCE_PATH_STYLE` must be `true` for MinIO and Cloudflare R2 (they use path-style URLs like `http://host/bucket/key`). Set it to `false` for AWS S3 (which uses virtual-hosted-style URLs like `http://bucket.s3.region.amazonaws.com/key`).

Also add to `apps/web/.env.example`:

```env
# No storage-specific env vars needed for the web app.
# The web app communicates with object storage exclusively
# through pre-signed URLs returned by the API.
```

---

## 3. Dependencies

Install in the API workspace only:

```bash
pnpm --filter @lifekeeper/api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

No new dependencies for the web app. The upload uses the browser's native `fetch` API with the pre-signed URL. No S3 SDK runs in the browser.

---

## 4. Prisma Schema Changes

File: `apps/api/prisma/schema.prisma`

### 4.1 Add the AttachmentEntityType enum

Place this with the other enum declarations near the top of the schema file, after `InvitationStatus` and before the `User` model:

```prisma
enum AttachmentEntityType {
  maintenance_log
  asset
  project_note
  project_expense
  project_phase
  project_task
  inventory_item
}
```

These seven entity types cover every surface where file attachments are useful. The enum is deliberately broad so we do not need a migration every time we add a new surface.

### 4.2 Add the Attachment model

Place this after the `BarcodeLookup` model (at the end of the schema file, before the closing of the file):

```prisma
// ── File Attachments ─────────────────────────────────────────────────

model Attachment {
  id               String               @id @default(cuid())
  householdId      String
  uploadedById     String
  entityType       AttachmentEntityType
  entityId         String
  storageKey       String               @unique
  originalFilename String
  mimeType         String
  fileSize         Int
  thumbnailKey     String?
  ocrResult        Json?
  caption          String?
  sortOrder        Int?
  status           String               @default("pending")
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt
  household        Household            @relation(fields: [householdId], references: [id], onDelete: Cascade)
  uploadedBy       User                 @relation("AttachmentUploader", fields: [uploadedById], references: [id], onDelete: Cascade)

  @@index([householdId])
  @@index([entityType, entityId])
  @@index([uploadedById])
  @@index([storageKey])
  @@index([status])
}
```

### 4.3 Add relation fields on existing models

On the `Household` model, add inside the relation fields block:

```prisma
attachments      Attachment[]
```

On the `User` model, add inside the relation fields block:

```prisma
attachments             Attachment[]          @relation("AttachmentUploader")
```

### 4.4 Run generation and migration

After making all schema changes:

```bash
pnpm db:generate
pnpm db:migrate
```

Name the migration something like `add_attachment_model`.

---

## 5. Fastify Storage Plugin

Create file: `apps/api/src/plugins/storage.ts`

This plugin initializes an S3Client and decorates the Fastify app instance with a `storage` object. Follow the exact same pattern as `apps/api/src/plugins/prisma.ts` which decorates `app.prisma`.

### 5.1 Implementation

```typescript
import fp from "fastify-plugin";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageService {
  generateUploadUrl(key: string, contentType: string, maxSizeBytes: number): Promise<string>;
  generateDownloadUrl(key: string, filename: string): Promise<string>;
  deleteObject(key: string): Promise<void>;
  headObject(key: string): Promise<{ contentLength: number; contentType: string } | null>;
}

const parseBoolean = (value: string | undefined): boolean => value === "true";

const getStorageConfig = () => ({
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  region: process.env.S3_REGION ?? "us-east-1",
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  bucket: process.env.S3_BUCKET ?? "lifekeeper-attachments",
  forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE ?? "true"),
  uploadExpiresSec: Number(process.env.S3_PRESIGN_UPLOAD_EXPIRES_SECONDS ?? "300"),
  downloadExpiresSec: Number(process.env.S3_PRESIGN_DOWNLOAD_EXPIRES_SECONDS ?? "3600"),
});

export const storagePlugin = fp(async (app) => {
  const config = getStorageConfig();

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  // Ensure the bucket exists on startup (helpful for MinIO local dev).
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    app.log.info(`Bucket "${config.bucket}" not found — creating it.`);
    try {
      await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
      app.log.info(`Bucket "${config.bucket}" created.`);
    } catch (createErr) {
      app.log.warn({ err: createErr }, `Could not create bucket "${config.bucket}". Storage operations will fail if it does not exist.`);
    }
  }

  const storage: StorageService = {
    async generateUploadUrl(key, contentType, _maxSizeBytes) {
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(client, command, { expiresIn: config.uploadExpiresSec });
    },

    async generateDownloadUrl(key, filename) {
      const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: `inline; filename="${filename}"`,
      });
      return getSignedUrl(client, command, { expiresIn: config.downloadExpiresSec });
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }));
    },

    async headObject(key) {
      try {
        const result = await client.send(new HeadObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        return {
          contentLength: result.ContentLength ?? 0,
          contentType: result.ContentType ?? "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
  };

  app.decorate("storage", storage);
});
```

### 5.2 TypeScript declaration

Add the Fastify type augmentation at the top of `apps/api/src/plugins/storage.ts` (before the plugin code), or in a separate declaration file at `apps/api/src/types/fastify.d.ts`. The augmentation should extend `FastifyInstance` to include:

```typescript
declare module "fastify" {
  interface FastifyInstance {
    storage: StorageService;
  }
}
```

If `apps/api/src/types/fastify.d.ts` already exists with the Prisma declaration, add the storage declaration there alongside it. If the Prisma declaration is inline in the prisma plugin file, follow the same inline pattern in the storage plugin file.

### 5.3 Register the plugin

In `apps/api/src/app.ts`, import and register:

```typescript
import { storagePlugin } from "./plugins/storage.js";
```

Register it after `prismaPlugin` and `authPlugin`, before route registrations:

```typescript
app.register(storagePlugin);
```

---

## 6. Zod Schemas and TypeScript Types

File: `packages/types/src/index.ts`

Add all of the following near the end of the file, before the final block of type exports. Follow the existing organizational pattern — schemas first, then type exports.

### 6.1 Enum values and schemas

```typescript
// ── Attachment Schemas ───────────────────────────────────────────────

export const attachmentEntityTypeValues = [
  "maintenance_log",
  "asset",
  "project_note",
  "project_expense",
  "project_phase",
  "project_task",
  "inventory_item",
] as const;

export const attachmentEntityTypeSchema = z.enum(attachmentEntityTypeValues);

export const attachmentStatusValues = ["pending", "active", "deleted"] as const;
export const attachmentStatusSchema = z.enum(attachmentStatusValues);
```

### 6.2 Attachment response schema

```typescript
export const attachmentSchema = z.object({
  id: z.string().cuid(),
  householdId: z.string().cuid(),
  uploadedById: z.string().cuid(),
  uploadedBy: shallowUserSchema.nullable().default(null),
  entityType: attachmentEntityTypeSchema,
  entityId: z.string(),
  storageKey: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int(),
  thumbnailKey: z.string().nullable(),
  ocrResult: z.record(z.string(), z.unknown()).nullable(),
  caption: z.string().nullable(),
  sortOrder: z.number().int().nullable(),
  status: attachmentStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### 6.3 Input schemas

```typescript
export const createAttachmentUploadSchema = z.object({
  entityType: attachmentEntityTypeSchema,
  entityId: z.string().min(1),
  filename: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(255),
  fileSize: z.number().int().min(1).max(52_428_800), // 50 MB
  caption: z.string().max(1000).optional(),
});

export const confirmAttachmentUploadSchema = z.object({});

export const updateAttachmentSchema = z.object({
  caption: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
});
```

### 6.4 Response schemas

```typescript
export const attachmentUploadResponseSchema = z.object({
  attachment: attachmentSchema,
  uploadUrl: z.string(),
});

export const attachmentListQuerySchema = z.object({
  entityType: attachmentEntityTypeSchema.optional(),
  entityId: z.string().optional(),
});
```

### 6.5 Type exports

Add to the type export block at the bottom of the file:

```typescript
export type AttachmentEntityType = z.infer<typeof attachmentEntityTypeSchema>;
export type AttachmentStatus = z.infer<typeof attachmentStatusSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type CreateAttachmentUploadInput = z.infer<typeof createAttachmentUploadSchema>;
export type ConfirmAttachmentUploadInput = z.infer<typeof confirmAttachmentUploadSchema>;
export type UpdateAttachmentInput = z.infer<typeof updateAttachmentSchema>;
export type AttachmentUploadResponse = z.infer<typeof attachmentUploadResponseSchema>;
```

---

## 7. API Routes

Create file: `apps/api/src/routes/attachments/index.ts`

### 7.1 Allowed MIME types

Define at the top of the file:

```typescript
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

const MAX_FILE_SIZE = 52_428_800; // 50 MB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
```

### 7.2 Helper: sanitize filename

```typescript
const sanitizeFilename = (filename: string): string =>
  filename.replace(/[^a-zA-Z0-9._-]/g, "_");
```

### 7.3 Helper: build storage key

```typescript
const buildStorageKey = (householdId: string, attachmentId: string, filename: string): string =>
  `households/${householdId}/attachments/${attachmentId}/${sanitizeFilename(filename)}`;
```

### 7.4 Helper: toAttachmentResponse

Follow the pattern used by every other route file (e.g., `toAssetResponse`, `toMaintenanceLogResponse`, `toProjectTaskResponse`). Map the Prisma record to the Zod-parsed response shape. Include the `uploadedBy` relation data if present, defaulting to null.

```typescript
const toAttachmentResponse = (
  attachment: Attachment & { uploadedBy?: { id: string; displayName: string | null } | null }
) => attachmentSchema.parse({
  id: attachment.id,
  householdId: attachment.householdId,
  uploadedById: attachment.uploadedById,
  uploadedBy: attachment.uploadedBy
    ? { id: attachment.uploadedBy.id, displayName: attachment.uploadedBy.displayName }
    : null,
  entityType: attachment.entityType,
  entityId: attachment.entityId,
  storageKey: attachment.storageKey,
  originalFilename: attachment.originalFilename,
  mimeType: attachment.mimeType,
  fileSize: attachment.fileSize,
  thumbnailKey: attachment.thumbnailKey,
  ocrResult: attachment.ocrResult as Record<string, unknown> | null,
  caption: attachment.caption,
  sortOrder: attachment.sortOrder,
  status: attachment.status,
  createdAt: attachment.createdAt.toISOString(),
  updatedAt: attachment.updatedAt.toISOString(),
});
```

(Note: the `Attachment` type here is the Prisma-generated model type from `@prisma/client`, not the Zod type from `@lifekeeper/types`.)

### 7.5 Helper: validate entity ownership

Create a function that verifies the target entity exists and belongs to the given household. This is critical for security — without it, a user could attach files to entities in other households.

```typescript
const validateEntityOwnership = async (
  prisma: PrismaClient,
  entityType: AttachmentEntityType,
  entityId: string,
  householdId: string
): Promise<boolean> => {
  switch (entityType) {
    case "asset": {
      const asset = await prisma.asset.findFirst({
        where: { id: entityId, householdId },
        select: { id: true },
      });
      return asset !== null;
    }
    case "maintenance_log": {
      const log = await prisma.maintenanceLog.findFirst({
        where: { id: entityId, asset: { householdId } },
        select: { id: true },
      });
      return log !== null;
    }
    case "project_note": {
      const note = await prisma.projectNote.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return note !== null;
    }
    case "project_expense": {
      const expense = await prisma.projectExpense.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return expense !== null;
    }
    case "project_phase": {
      const phase = await prisma.projectPhase.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return phase !== null;
    }
    case "project_task": {
      const task = await prisma.projectTask.findFirst({
        where: { id: entityId, project: { householdId } },
        select: { id: true },
      });
      return task !== null;
    }
    case "inventory_item": {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: entityId, householdId },
        select: { id: true },
      });
      return item !== null;
    }
    default:
      return false;
  }
};
```

### 7.6 Route definitions

Use standard Zod param schemas:

```typescript
const householdParamsSchema = z.object({
  householdId: z.string().cuid(),
});

const attachmentParamsSchema = z.object({
  householdId: z.string().cuid(),
  attachmentId: z.string().cuid(),
});
```

#### POST `/v1/households/:householdId/attachments/upload`

- Parse params with `householdParamsSchema`.
- Parse body with `createAttachmentUploadSchema`.
- Assert household membership using `assertMembership` from `../../lib/asset-access.js`.
- Validate `mimeType` is in ALLOWED_MIME_TYPES. Return 400 if not, with a message listing allowed types.
- Validate `fileSize` does not exceed MAX_FILE_SIZE. Return 400 if it does.
- Call `validateEntityOwnership`. Return 404 with message "Entity not found or does not belong to this household." if false.
- Generate a temporary cuid for the attachment ID (use `@prisma/client`'s cuid generation — or just let Prisma auto-generate it by creating the record first).
- Create the Attachment record in the database with status `"pending"`, computing the storageKey via `buildStorageKey`.
- Call `app.storage.generateUploadUrl(storageKey, mimeType, fileSize)`.
- Return `{ attachment: toAttachmentResponse(record), uploadUrl }` with status 201.

#### POST `/v1/households/:householdId/attachments/:attachmentId/confirm`

- Parse params with `attachmentParamsSchema`.
- Assert household membership.
- Find the attachment by ID where `householdId` matches and `status` is `"pending"`.
- If not found, return 404.
- Call `app.storage.headObject(attachment.storageKey)`.
- If headObject returns null, return 400 with message "File not found in storage. The upload may not have completed."
- Update the attachment: set `status` to `"active"`, update `fileSize` from headObject response if it differs from the stored value.
- Log activity: `{ householdId, userId, action: "attachment.confirmed", entityType: "attachment", entityId: attachment.id, metadata: { parentEntityType: attachment.entityType, parentEntityId: attachment.entityId, filename: attachment.originalFilename } }`.
- Return the updated attachment.

#### GET `/v1/households/:householdId/attachments`

- Parse params with `householdParamsSchema`.
- Parse query string with `attachmentListQuerySchema`.
- Assert household membership.
- Build a Prisma `where` clause: `{ householdId, status: "active" }`. If `entityType` is provided, add it to the where clause. If `entityId` is also provided, add it too.
- Query with `orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]`.
- Include `uploadedBy: { select: { id: true, displayName: true } }`.
- Return `attachments.map(toAttachmentResponse)`.

#### GET `/v1/households/:householdId/attachments/:attachmentId/download`

- Parse params with `attachmentParamsSchema`.
- Assert household membership.
- Find the attachment by ID where `householdId` matches and `status` is `"active"`.
- If not found, return 404.
- Call `app.storage.generateDownloadUrl(attachment.storageKey, attachment.originalFilename)`.
- Return `{ url }`.

#### PATCH `/v1/households/:householdId/attachments/:attachmentId`

- Parse params with `attachmentParamsSchema`.
- Parse body with `updateAttachmentSchema`.
- Assert household membership.
- Find the attachment by ID where `householdId` matches and `status` is `"active"`.
- If not found, return 404.
- Update the attachment with the provided fields (caption, sortOrder).
- Return the updated attachment.

#### DELETE `/v1/households/:householdId/attachments/:attachmentId`

- Parse params with `attachmentParamsSchema`.
- Assert household membership.
- Find the attachment by ID where `householdId` matches and `status` is NOT `"deleted"`.
- If not found, return 404.
- Update the attachment: set `status` to `"deleted"`.
- Log activity: `{ householdId, userId, action: "attachment.deleted", entityType: "attachment", entityId: attachment.id, metadata: { parentEntityType: attachment.entityType, parentEntityId: attachment.entityId, filename: attachment.originalFilename } }`.
- Return 204 (no content).

### 7.7 Register in app.ts

In `apps/api/src/app.ts`:

```typescript
import { attachmentRoutes } from "./routes/attachments/index.js";
```

Add registration alongside other routes:

```typescript
app.register(attachmentRoutes);
```

---

## 8. Web API Client Methods

File: `apps/web/lib/api.ts`

### 8.1 Imports

Add to the existing import block from `@lifekeeper/types`:

```typescript
import {
  // ... existing imports ...
  attachmentSchema,
  attachmentUploadResponseSchema,
  type Attachment,
  type AttachmentUploadResponse,
  type AttachmentEntityType,
  type CreateAttachmentUploadInput,
  type UpdateAttachmentInput,
} from "@lifekeeper/types";
```

### 8.2 Methods

Add these methods following the existing patterns in the file (apiRequest with path, method, body, schema):

```typescript
// ── Attachments ──────────────────────────────────────────────────────

export const requestAttachmentUpload = async (
  householdId: string,
  input: CreateAttachmentUploadInput
): Promise<AttachmentUploadResponse> => apiRequest({
  path: `/v1/households/${householdId}/attachments/upload`,
  method: "POST",
  body: input,
  schema: attachmentUploadResponseSchema,
});

export const confirmAttachmentUpload = async (
  householdId: string,
  attachmentId: string
): Promise<Attachment> => apiRequest({
  path: `/v1/households/${householdId}/attachments/${attachmentId}/confirm`,
  method: "POST",
  body: {},
  schema: attachmentSchema,
});

export const fetchAttachments = async (
  householdId: string,
  entityType?: AttachmentEntityType,
  entityId?: string
): Promise<Attachment[]> => {
  const params = new URLSearchParams();
  if (entityType) params.set("entityType", entityType);
  if (entityId) params.set("entityId", entityId);
  const query = params.toString();
  const path = `/v1/households/${householdId}/attachments${query ? `?${query}` : ""}`;
  return apiRequest({ path, schema: attachmentSchema.array() });
};

export const getAttachmentDownloadUrl = async (
  householdId: string,
  attachmentId: string
): Promise<{ url: string }> => apiRequest({
  path: `/v1/households/${householdId}/attachments/${attachmentId}/download`,
});

export const updateAttachment = async (
  householdId: string,
  attachmentId: string,
  input: UpdateAttachmentInput
): Promise<Attachment> => apiRequest({
  path: `/v1/households/${householdId}/attachments/${attachmentId}`,
  method: "PATCH",
  body: input,
  schema: attachmentSchema,
});

export const deleteAttachment = async (
  householdId: string,
  attachmentId: string
): Promise<void> => {
  await apiRequest({
    path: `/v1/households/${householdId}/attachments/${attachmentId}`,
    method: "DELETE",
  });
};
```

---

## 9. CSS for Attachment Components

File: `apps/web/app/globals.css`

Add a new section at the end of the file, following the existing organizational pattern (each section has a comment header like `/* ── Section Name ── */`):

```css
/* ── Attachments ───────────────────────────────────────────────────── */

/* Upload drop zone */
.attachment-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-alt);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.attachment-upload:hover,
.attachment-upload--dragover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--surface-alt));
}

.attachment-upload__label {
  font-size: 0.85rem;
  color: var(--ink-muted);
  text-align: center;
}

.attachment-upload__label strong {
  color: var(--accent);
  cursor: pointer;
}

.attachment-upload__hint {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.attachment-upload__progress {
  width: 100%;
  max-width: 300px;
}

.attachment-upload__progress-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.attachment-upload__progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}

.attachment-upload__progress-text {
  font-size: 0.75rem;
  color: var(--ink-muted);
  text-align: center;
  margin-top: 4px;
}

.attachment-upload__error {
  font-size: 0.82rem;
  color: var(--danger);
}

/* Gallery grid for viewing attachments */
.attachment-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.attachment-gallery--compact {
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 6px;
}

.attachment-gallery__item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.attachment-gallery__item:hover {
  box-shadow: 0 0 0 2px var(--accent);
}

.attachment-gallery__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attachment-gallery__item--pdf {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.attachment-gallery__item--pdf .attachment-gallery__icon {
  font-size: 1.5rem;
  color: var(--ink-muted);
}

.attachment-gallery__item--pdf .attachment-gallery__filename {
  font-size: 0.7rem;
  color: var(--ink-muted);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.attachment-gallery__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.15s;
}

.attachment-gallery__item:hover .attachment-gallery__remove {
  opacity: 1;
}

/* Inline attachment list (for non-image files or list view) */
.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.attachment-list__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 0.85rem;
}

.attachment-list__item-icon {
  flex-shrink: 0;
  color: var(--ink-muted);
}

.attachment-list__item-info {
  flex: 1;
  min-width: 0;
}

.attachment-list__item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
}

.attachment-list__item-meta {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.attachment-list__item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* Lightbox overlay for full-size image viewing */
.attachment-lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  animation: fade-in 0.15s ease-out;
}

.attachment-lightbox__image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--radius);
}

.attachment-lightbox__close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.attachment-lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.attachment-lightbox__nav--prev {
  left: 16px;
}

.attachment-lightbox__nav--next {
  right: 16px;
}

.attachment-lightbox__caption {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: var(--radius);
  font-size: 0.85rem;
  max-width: 80vw;
  text-align: center;
}

.attachment-lightbox__counter {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.82rem;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Empty state for attachment areas */
.attachment-empty {
  padding: 16px;
  text-align: center;
  font-size: 0.82rem;
  color: var(--ink-muted);
}

/* ── Responsive attachment overrides ── */
@media (max-width: 640px) {
  .attachment-gallery {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  }

  .attachment-lightbox__image {
    max-width: 95vw;
    max-height: 80vh;
  }
}
```

---

## 10. Reusable Frontend Components

All new components go in `apps/web/components/`. Every component in this section is a client component (`"use client"` directive) because they manage interactive state (file selection, upload progress, lightbox visibility).

### 10.1 `AttachmentUploader` component

File: `apps/web/components/attachment-uploader.tsx`

**Purpose:** A drop-zone + file picker component that handles the entire upload lifecycle: file selection, validation, pre-signed URL request, direct upload to S3, confirmation, and callback.

**Props:**

```typescript
type AttachmentUploaderProps = {
  householdId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  onUploadComplete: (attachment: Attachment) => void;
  onError?: (message: string) => void;
  accept?: string;           // defaults to "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
  maxFileSizeMb?: number;    // defaults to 50
  multiple?: boolean;        // defaults to true
  compact?: boolean;         // smaller version for inline use
  label?: string;            // custom label text
};
```

**Behavior:**

1. Renders a dashed-border drop zone with a hidden `<input type="file">`. Clicking anywhere in the zone triggers the file picker. Dragging files over the zone highlights it with the `--dragover` modifier class.
2. When files are selected (via click or drop), validate each file:
   - Check MIME type against the `accept` prop. Show inline error for rejected files.
   - Check file size against `maxFileSizeMb`. Show inline error for oversized files.
3. For each valid file, sequentially:
   a. Show a progress indicator (filename + progress bar).
   b. Call `requestAttachmentUpload(householdId, { entityType, entityId, filename, mimeType, fileSize })`.
   c. Upload the file to the returned `uploadUrl` using `fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })`. Track upload progress using XMLHttpRequest if the `fetch` API does not provide progress events — use `xhr.upload.onprogress` to update the progress bar percentage.
   d. On successful upload, call `confirmAttachmentUpload(householdId, attachment.id)`.
   e. Call `onUploadComplete(confirmedAttachment)`.
   f. Clear the progress indicator for that file.
4. If any step fails, show the error message inline and call `onError` if provided. Do not halt other file uploads in a multi-file batch.
5. After all uploads complete, reset the drop zone to its default state.

**Important implementation notes:**

- Use `XMLHttpRequest` for the actual S3 upload (not `fetch`) because `fetch` does not expose upload progress. The pre-signed URL request and confirm calls can use `fetch` via the api.ts client methods.
- The component must handle HEIC/HEIF files gracefully — these are common iPhone photo formats. They upload fine but cannot be previewed in the browser. The gallery component (below) will handle this by showing a generic image icon.
- The component does NOT render previously uploaded attachments. It is purely an upload widget. Display is handled by `AttachmentGallery`.

### 10.2 `AttachmentGallery` component

File: `apps/web/components/attachment-gallery.tsx`

**Purpose:** Displays a grid of attachment thumbnails/icons with lightbox viewing, download, and delete capabilities.

**Props:**

```typescript
type AttachmentGalleryProps = {
  householdId: string;
  attachments: Attachment[];
  onDelete?: (attachmentId: string) => void;
  compact?: boolean;         // smaller thumbnails
  readonly?: boolean;        // hide delete buttons
};
```

**Behavior:**

1. Renders a CSS grid (`.attachment-gallery`) of attachment items.
2. For image attachments (`mimeType` starts with `image/`):
   - Render an `<img>` tag. The `src` is loaded lazily — when the component mounts (or the image scrolls into view), call `getAttachmentDownloadUrl` to get a pre-signed URL, then set it as the image source. Cache the URL in component state so repeated renders don't re-fetch.
   - On click, open the lightbox (see below).
3. For PDF attachments:
   - Render a PDF icon (use a simple SVG icon or a text glyph like `📄`) with the truncated filename below it.
   - On click, call `getAttachmentDownloadUrl` and open the URL in a new tab.
4. On hover, show a delete button (small × circle in the top-right corner) if `readonly` is false.
5. Clicking delete calls `deleteAttachment(householdId, attachmentId)`, then calls `onDelete` to let the parent update its state.

**Image URL caching strategy:**

Pre-signed URLs expire (default 1 hour). The component should store URLs in a `Map<string, { url: string; expiresAt: number }>` in state. When rendering, check if the cached URL is still valid (current time < expiresAt minus a 5-minute buffer). If expired, fetch a new one. Set `expiresAt` to `Date.now() + (55 * 60 * 1000)` (55 minutes, giving a 5-minute safety margin on the 60-minute expiry).

### 10.3 `AttachmentLightbox` component

File: `apps/web/components/attachment-lightbox.tsx`

**Purpose:** Full-screen overlay for viewing images at full resolution with left/right navigation.

**Props:**

```typescript
type AttachmentLightboxProps = {
  images: Array<{ id: string; url: string; caption?: string | null; filename: string }>;
  initialIndex: number;
  onClose: () => void;
};
```

**Behavior:**

1. Renders a fixed-position overlay (`.attachment-lightbox`) with the image centered.
2. Shows left/right navigation arrows if there are multiple images. Clicking arrows or pressing arrow keys navigates between images.
3. Shows the image counter ("2 / 5") at the top center.
4. Shows the caption (or filename if no caption) at the bottom center.
5. Clicking the backdrop (outside the image), pressing Escape, or clicking the × button closes the lightbox.
6. Trap focus inside the lightbox while it is open. Restore focus when closed.
7. Prevent body scroll while the lightbox is open (`document.body.style.overflow = "hidden"` on mount, restore on unmount).

### 10.4 `AttachmentSection` component

File: `apps/web/components/attachment-section.tsx`

**Purpose:** A combined component that renders both the gallery (existing attachments) and the uploader (add new) in a single section. This is the primary component integrated into each surface.

**Props:**

```typescript
type AttachmentSectionProps = {
  householdId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  compact?: boolean;
  readonly?: boolean;
  label?: string;            // section heading, defaults to "Photos & Documents"
};
```

**Behavior:**

1. On mount, fetch attachments using `fetchAttachments(householdId, entityType, entityId)`. Store in state.
2. Render a section with:
   - A heading (the `label` prop, or "Photos & Documents").
   - The `AttachmentGallery` showing existing attachments.
   - The `AttachmentUploader` below the gallery (unless `readonly` is true).
3. When `onUploadComplete` fires from the uploader, append the new attachment to the state array (optimistic — no need to re-fetch).
4. When `onDelete` fires from the gallery, remove the attachment from the state array.

---

## 11. Surface Integrations

These are the specific pages and forms where `AttachmentSection` should be wired in. For each surface, the integration is the same pattern: import `AttachmentSection`, render it with the correct `entityType` and `entityId`, and pass the current `householdId`.

### 11.1 Asset detail page — Photos & Documents tab/section

**File:** `apps/web/app/assets/[assetId]/page.tsx`

**Entity type:** `"asset"`
**Entity ID:** The asset's `id`

**Integration point:** Add an `AttachmentSection` inside the asset detail view. This belongs in the Maintenance tab area or as its own section on the detail page, positioned after the maintenance log and before or alongside existing content. Wrap it in a `<Card title="Photos & Documents">` on the Settings tab or as a standalone panel on the Overview tab.

The asset photo section is where users store general reference photos of the asset itself — a photo of their truck, a shot of the model/serial plate, the garage where equipment is stored, etc.

### 11.2 Maintenance log form — Receipt/photo attachment

**File:** `apps/web/components/log-maintenance-form.tsx`

**Entity type:** `"maintenance_log"`

**Integration point:** This is a special case because the maintenance log does not exist yet when the user is filling out the form. There are two options:

**Option A (recommended — simpler):** After the log is successfully created (via `createLogAction`), display the `AttachmentSection` for the newly created log. This means the log form creates the record first, and then on the confirmation/success state (or after redirect to the asset detail page where the log now appears), the user can attach files.

To implement this: in the Maintenance Log list on the asset detail page (`apps/web/app/assets/[assetId]/page.tsx`), add an expand/collapse toggle on each log entry. When expanded, render `AttachmentSection` with `entityType="maintenance_log"` and `entityId={log.id}`. This lets users attach receipts and photos to any existing log entry at any time, which is actually more useful than only allowing it during initial creation.

### 11.3 Project notes

**File:** `apps/web/app/projects/[projectId]/page.tsx`

**Entity type:** `"project_note"`
**Entity ID:** The note's `id`

**Integration point:** Inside the notes section, when a note is displayed, add a compact `AttachmentSection` below the note body. Use `compact={true}` to keep the thumbnails small since notes are displayed in a stacked list.

### 11.4 Project expenses

**File:** `apps/web/app/projects/[projectId]/page.tsx`

**Entity type:** `"project_expense"`
**Entity ID:** The expense's `id`

**Integration point:** In the Budget & Expenses section, each expense row should have an expandable area (or a small icon indicating attachments exist) that reveals a compact `AttachmentSection` for receipt/invoice photos.

### 11.5 Project phases — Progress photos

**File:** `apps/web/app/projects/[projectId]/page.tsx`

**Entity type:** `"project_phase"`
**Entity ID:** The phase's `id`

**Integration point:** Inside the phase detail/editing area, add an `AttachmentSection` labeled "Progress Photos." This is where users document visual progress through a project — before/during/after shots of a renovation phase, for example.

### 11.6 Project tasks

**File:** `apps/web/app/projects/[projectId]/page.tsx`

**Entity type:** `"project_task"`
**Entity ID:** The task's `id`

**Integration point:** In the task detail/editing area, add a compact `AttachmentSection`. This supports reference photos for a task (e.g., a screenshot of a product to buy, a diagram showing where to cut, a photo of the completed work).

### 11.7 Inventory items

**File:** `apps/web/app/inventory/page.tsx` and any inventory detail view

**Entity type:** `"inventory_item"`
**Entity ID:** The inventory item's `id`

**Integration point:** In the inventory item's expandable row or detail view, add a compact `AttachmentSection`. Useful for photos of the actual part, packaging labels, or storage location markers.

---

## 12. Server Actions

File: `apps/web/app/actions.ts`

No new server actions are needed for attachments. The upload pipeline is entirely client-side (client component calling the API client methods directly). The `AttachmentUploader` component calls the API methods from `apps/web/lib/api.ts` directly, not through server actions, because:

1. File uploads must be initiated from the client (the browser needs to send the file to S3 directly).
2. Pre-signed URL requests and confirmations are simple API calls that don't need server-action revalidation.
3. The `AttachmentSection` manages its own state and doesn't need form-based submission.

However, if you need to revalidate a page path after an attachment change (e.g., to update the attachment count displayed in a server component), you can add a lightweight action:

```typescript
export async function revalidateAttachmentsAction(formData: FormData): Promise<void> {
  const assetId = getOptionalString(formData, "assetId");
  if (assetId) {
    revalidateAssetPaths(assetId);
  }
  const projectId = getOptionalString(formData, "projectId");
  const householdId = getOptionalString(formData, "householdId");
  if (projectId && householdId) {
    revalidateProjectPaths(householdId, projectId);
  }
}
```

---

## 13. Constraints and Boundaries

### Do

- Follow existing code conventions exactly: Fastify plugin pattern, Zod schemas in packages/types, typed API client in apps/web/lib/api.ts, activity logging for mutations, CSS in globals.css with existing custom properties.
- Use the polymorphic pattern (entityType + entityId strings) consistent with ActivityLog and InventoryTransaction.
- Auto-create the S3 bucket on plugin startup for MinIO local dev convenience.
- Cache pre-signed download URLs in client component state with expiration tracking.
- Use XMLHttpRequest for S3 uploads to get progress events.
- Keep all new CSS in the existing `apps/web/app/globals.css` file under a clearly labeled section header.
- Make the `AttachmentSection` component self-contained — it fetches its own data and manages its own state.

### Do NOT

- Do not implement OCR text extraction. That is a separate future pass.
- Do not implement server-side thumbnail generation. Images display at full resolution via pre-signed URLs. The gallery component uses CSS `object-fit: cover` for the grid thumbnails.
- Do not build a cleanup worker for orphaned pending attachments. Pending records with no corresponding S3 object are harmless and can be cleaned up later.
- Do not modify the existing `ProjectNote.attachmentUrl` and `ProjectNote.attachmentName` schema fields. They will be migrated in a future cleanup pass. The new `Attachment` model is the correct path for all new file storage.
- Do not modify any existing route files, existing component behavior, or existing Prisma models beyond adding the two relation fields on User and Household.
- Do not introduce any new npm dependencies in the web app. The browser's native `fetch`, `XMLHttpRequest`, `FileReader`, and `URL.createObjectURL` APIs are sufficient.
- Do not add any new CSS files or CSS modules. All styles go in globals.css.
- Do not stream file bytes through the Fastify API. All file transfer happens directly between the browser and the S3-compatible endpoint via pre-signed URLs.
- Do not use `any` types. TypeScript strict mode is enforced.
- Do not hardcode MinIO credentials or endpoint URLs. All storage configuration comes from environment variables.
- Do not add Fastify body size limits for file uploads — file bytes never flow through Fastify.

---

## File Summary

New files to create:
- `apps/api/src/plugins/storage.ts` — Fastify S3 client plugin
- `apps/api/src/routes/attachments/index.ts` — Attachment API routes
- `apps/web/components/attachment-uploader.tsx` — Upload drop zone component
- `apps/web/components/attachment-gallery.tsx` — Thumbnail grid display
- `apps/web/components/attachment-lightbox.tsx` — Full-screen image viewer
- `apps/web/components/attachment-section.tsx` — Combined gallery + uploader section

Files to modify:
- `apps/api/prisma/schema.prisma` — Add AttachmentEntityType enum and Attachment model, add relation fields on User and Household
- `apps/api/src/app.ts` — Import and register storagePlugin and attachmentRoutes
- `apps/api/.env.example` — Add S3 environment variables
- `packages/types/src/index.ts` — Add all attachment Zod schemas and type exports
- `apps/web/lib/api.ts` — Add attachment API client methods and imports
- `apps/web/app/globals.css` — Add attachment CSS section
- `apps/web/app/assets/[assetId]/page.tsx` — Integrate AttachmentSection for asset photos and per-log-entry attachments
- `apps/web/components/log-maintenance-form.tsx` — No changes to the form itself; attachments are added post-creation via the log entry's expanded view
- `apps/web/app/projects/[projectId]/page.tsx` — Integrate AttachmentSection for notes, expenses, phases, and tasks
- `apps/web/app/inventory/page.tsx` — Integrate AttachmentSection for inventory items
