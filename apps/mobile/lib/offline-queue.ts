import { mmkvGet, mmkvSet } from "./storage";
import { STORAGE_KEYS } from "./constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MutationMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export interface QueuedMutation {
  /** UUID for deduplication */
  id: string;
  method: MutationMethod;
  /** Full API path, e.g. "/v1/households/abc/entries" */
  path: string;
  /** Request payload (will be JSON.stringify'd) */
  body?: unknown;
  /** Unix timestamp (ms) when the mutation was enqueued */
  timestamp: number;
  /** Domain type for cache invalidation hints */
  entityType: string;
  /** Optional entity ID for optimistic update rollbacks */
  entityId?: string;
  status: "pending" | "failed";
  retryCount: number;
  /** Human-readable description for the "pending sync" UI */
  description?: string;
}

export interface UploadQueueEntry {
  id: string;
  /** Local file URI (expo-file-system) */
  localUri: string;
  entityType: string;
  entityId: string;
  timestamp: number;
  status: "pending" | "failed";
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Mutation Queue (MMKV-backed)
// ---------------------------------------------------------------------------

function readQueue(): QueuedMutation[] {
  return mmkvGet<QueuedMutation[]>(STORAGE_KEYS.MUTATION_QUEUE) ?? [];
}

function writeQueue(queue: QueuedMutation[]): void {
  mmkvSet(STORAGE_KEYS.MUTATION_QUEUE, queue);
}

/** Add a mutation to the end of the queue */
export function enqueueMutation(mutation: Omit<QueuedMutation, "id" | "timestamp" | "status" | "retryCount">): QueuedMutation {
  const entry: QueuedMutation = {
    ...mutation,
    id: generateId(),
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  };
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  return entry;
}

/** Remove a mutation from the queue by ID (call on success) */
export function dequeueMutation(id: string): void {
  const queue = readQueue().filter((m) => m.id !== id);
  writeQueue(queue);
}

/** Mark a mutation as failed (will surface to user) */
export function markMutationFailed(id: string): void {
  const queue = readQueue().map((m) =>
    m.id === id ? { ...m, status: "failed" as const, retryCount: m.retryCount + 1 } : m
  );
  writeQueue(queue);
}

/** Re-enqueue a failed mutation for retry */
export function retryMutation(id: string): void {
  const queue = readQueue().map((m) =>
    m.id === id ? { ...m, status: "pending" as const } : m
  );
  writeQueue(queue);
}

/** Discard a failed mutation */
export function discardMutation(id: string): void {
  dequeueMutation(id);
}

export function getPendingMutations(): QueuedMutation[] {
  return readQueue().filter((m) => m.status === "pending");
}

export function getFailedMutations(): QueuedMutation[] {
  return readQueue().filter((m) => m.status === "failed");
}

export function getPendingCount(): number {
  return getPendingMutations().length;
}

export function getFailedCount(): number {
  return getFailedMutations().length;
}

// ---------------------------------------------------------------------------
// Upload Queue (MMKV-backed)
// ---------------------------------------------------------------------------

function readUploadQueue(): UploadQueueEntry[] {
  return mmkvGet<UploadQueueEntry[]>(STORAGE_KEYS.UPLOAD_QUEUE) ?? [];
}

function writeUploadQueue(queue: UploadQueueEntry[]): void {
  mmkvSet(STORAGE_KEYS.UPLOAD_QUEUE, queue);
}

export function enqueueUpload(entry: Omit<UploadQueueEntry, "id" | "timestamp" | "status" | "retryCount">): UploadQueueEntry {
  const queued: UploadQueueEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  };
  const queue = readUploadQueue();
  queue.push(queued);
  writeUploadQueue(queue);
  return queued;
}

export function dequeueUpload(id: string): void {
  writeUploadQueue(readUploadQueue().filter((u) => u.id !== id));
}

export function markUploadFailed(id: string): void {
  const queue = readUploadQueue().map((u) =>
    u.id === id ? { ...u, status: "failed" as const, retryCount: u.retryCount + 1 } : u
  );
  writeUploadQueue(queue);
}

export function getPendingUploads(): UploadQueueEntry[] {
  return readUploadQueue().filter((u) => u.status === "pending");
}

// ---------------------------------------------------------------------------
// Flush (called by useOfflineSync when connectivity is restored)
// ---------------------------------------------------------------------------

/**
 * Attempt to send a single queued mutation over the network.
 * The actual HTTP call is delegated to the caller via the `execute` callback
 * so this module stays free of fetch/auth dependencies.
 */
export async function flushMutations(
  execute: (mutation: QueuedMutation) => Promise<void>
): Promise<{ flushed: number; failed: number }> {
  const pending = getPendingMutations();
  let flushed = 0;
  let failed = 0;

  for (const mutation of pending) {
    try {
      await execute(mutation);
      dequeueMutation(mutation.id);
      flushed++;
    } catch {
      markMutationFailed(mutation.id);
      failed++;
    }
  }

  return { flushed, failed };
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
