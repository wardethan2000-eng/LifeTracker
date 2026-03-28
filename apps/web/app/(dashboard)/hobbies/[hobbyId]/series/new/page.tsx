import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { createHobbySeriesAction } from "../../../../../actions";
import { HobbySeriesWorkbench } from "../../../../../../components/hobby-series-workbench";
import { ApiError, getHobbyDetail, getMe } from "../../../../../../lib/api";

type NewHobbySeriesPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function NewHobbySeriesPage({ params }: NewHobbySeriesPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>New Series</h1></header>
        <div className="page-body"><p>No household found.</p></div>
      </>
    );
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading…</div></div>}>
      <NewSeriesContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function NewSeriesContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const hobby = await getHobbyDetail(householdId, hobbyId);

    return (
      <>
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=series`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← {hobby.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>New Series</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbySeriesWorkbench action={createHobbySeriesAction} householdId={householdId} hobbyId={hobbyId} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>New Series</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}