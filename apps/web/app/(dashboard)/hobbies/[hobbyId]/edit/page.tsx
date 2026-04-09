import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { hobbyPresetLibrary } from "@aegis/presets";
import { updateHobbyAction } from "../../../../actions";
import { HobbyWorkbench } from "../../../../../components/hobby-workbench";
import { ApiError, getHobbyDetail, getMe } from "../../../../../lib/api";

type EditHobbyPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function EditHobbyPage({ params }: EditHobbyPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>Edit Hobby</h1></header>
        <div className="page-body"><p>No household found.</p></div>
      </>
    );
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <EditContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function EditContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const hobby = await getHobbyDetail(householdId, hobbyId);
    const initialHobby = {
      id: hobby.id,
      name: hobby.name,
      description: hobby.description,
      status: hobby.status,
      activityMode: hobby.activityMode,
      lifecycleMode: hobby.lifecycleMode,
      hobbyType: hobby.hobbyType,
      notes: hobby.notes,
      statusPipeline: hobby.statusPipeline,
      inventoryLinks: hobby.inventoryLinks,
    };

    return (
      <>
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=settings`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← {hobby.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>Edit Hobby</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbyWorkbench
            mode="edit"
            action={updateHobbyAction}
            householdId={householdId}
            presets={hobbyPresetLibrary}
            initialHobby={initialHobby}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Edit Hobby</h1></header>
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