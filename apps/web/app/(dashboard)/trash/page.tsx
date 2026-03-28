import { Suspense, type JSX } from "react";
import { getMe, getHouseholdTrash } from "../../../lib/api";
import { TrashPageClient } from "./trash-client";

export const metadata = { title: "Trash" };

async function TrashContent({ householdId }: { householdId: string }): Promise<JSX.Element> {
  let trashData = { items: [] as Awaited<ReturnType<typeof getHouseholdTrash>>["items"], total: 0 };

  try {
    trashData = await getHouseholdTrash(householdId);
  } catch {
    // fall through with empty
  }

  return (
    <main className="trash-page">
      <div className="trash-page__header">
        <div>
          <h1 className="trash-page__title">Trash</h1>
          <p className="trash-page__subtitle">
            Deleted items are kept for 30 days before being permanently removed.
            Hobbies are deleted immediately and do not appear here.
          </p>
        </div>
      </div>
      <TrashPageClient
        householdId={householdId}
        items={trashData.items}
        total={trashData.total}
      />
    </main>
  );
}

export default async function TrashPage(): Promise<JSX.Element> {
  let householdId: string | null = null;

  try {
    const me = await getMe();
    householdId = me.households[0]?.id ?? null;
  } catch {
    // handled below
  }

  if (!householdId) {
    return (
      <main className="trash-page">
        <h1 className="trash-page__title">Trash</h1>
        <p className="trash-page__empty">No household found.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={<main className="trash-page"><h1 className="trash-page__title">Trash</h1><p className="note">Loading…</p></main>}>
      <TrashContent householdId={householdId} />
    </Suspense>
  );
}
