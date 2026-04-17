import type { JSX } from "react";
import { ApiError, getMe } from "../../../../../lib/api";
import { EntityNotesWorkspace } from "../../../../../components/entity-notes-workspace";

type AssetNotesPageProps = {
  params: Promise<{ assetId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AssetNotesPage({ params, searchParams }: AssetNotesPageProps): Promise<JSX.Element> {
  const { assetId } = await params;
  void searchParams;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    return (
        <EntityNotesWorkspace
          householdId={household.id}
          entityType="asset"
          entityId={assetId}
          backToHref={`/assets/${assetId}/notes?householdId=${household.id}`}
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
