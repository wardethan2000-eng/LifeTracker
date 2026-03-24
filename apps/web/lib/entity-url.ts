/**
 * Shared utility for resolving entity detail page URLs and display names
 * from activity log entries, trash entries, or any other context where
 * only entityType + entityId + metadata are available.
 */

const ENTITY_LABEL_MAP: Record<string, string> = {
  asset: "Asset",
  project: "Project",
  inventory_item: "Inventory Item",
  hobby: "Hobby",
  service_provider: "Service Provider",
  schedule: "Schedule",
  log: "Log",
  timeline_entry: "Timeline Entry",
  comment: "Comment",
  invitation: "Invitation",
  idea: "Idea",
  entry: "Note",
  note_folder: "Note Folder",
  note_template: "Note Template",
  idea_canvas: "Canvas",
  project_task: "Task",
  household: "Household",
  attachment: "Attachment",
  share_link: "Share Link",
  inventory_transaction: "Transaction",
  inventory_purchase: "Purchase",
  project_phase_supply: "Supply",
};

/** Returns a human-readable label for an entity type (e.g. "inventory_item" → "Inventory Item"). */
export function getEntityLabel(entityType: string): string {
  return (
    ENTITY_LABEL_MAP[entityType] ??
    entityType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Returns a navigable URL for the entity, or `null` if no detail page exists.
 *
 * For sub-entities (schedule, log, timeline_entry) the parent asset ID must be
 * present in `metadata.assetId` to produce a link. For comments, `metadata.targetType`
 * and `metadata.targetId` are used to resolve the parent entity URL.
 */
export function getEntityUrl(
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown> | null,
): string | null {
  switch (entityType) {
    case "asset":
      return `/assets/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    case "inventory_item":
      return `/inventory/${entityId}`;
    case "hobby":
      return `/hobbies/${entityId}`;
    case "service_provider":
      return `/service-providers/${entityId}`;
    case "idea":
      return `/ideas/${entityId}`;
    case "entry":
      return `/notes/${entityId}`;
    case "schedule":
    case "log":
    case "timeline_entry": {
      const assetId = metadata?.assetId;
      if (typeof assetId === "string" && assetId.length > 0) {
        return `/assets/${assetId}`;
      }
      return null;
    }
    case "comment": {
      const targetType = metadata?.targetType;
      const targetId = metadata?.targetId;
      if (typeof targetType === "string" && typeof targetId === "string") {
        return getEntityUrl(targetType, targetId);
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Returns a human-readable display name for the entity.
 *
 * Checks `metadata.name`, `metadata.title`, and `metadata.entityName` in order.
 * For comments, uses `metadata.targetName` prefixed with "Comment on…".
 * Falls back to the first 8 characters of the raw entity ID.
 */
export function getEntityDisplayName(
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown> | null,
): string {
  if (entityType === "comment") {
    const targetName = metadata?.targetName;
    if (typeof targetName === "string" && targetName.length > 0) {
      return `Comment on "${targetName}"`;
    }
  }

  const name =
    metadata?.name ??
    metadata?.title ??
    metadata?.entityName;

  if (typeof name === "string" && name.length > 0) {
    return name;
  }

  return entityId.slice(0, 8);
}
