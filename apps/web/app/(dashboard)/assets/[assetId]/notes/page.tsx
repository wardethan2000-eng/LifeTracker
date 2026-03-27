import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntryTimeline } from "../../../../../components/entry-system";

type AssetNotesPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetNotesPage({ params }: AssetNotesPageProps): Promise<JSX.Element> {
  const { assetId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    return (
      <EntryTimeline
        householdId={household.id}
        entityType="asset"
        entityId={assetId}
        title="Asset Notes"
        quickAddLabel="Note"
        entryHrefTemplate={`/assets/${assetId}/notes#entry-{entryId}`}
      />
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load notes: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
