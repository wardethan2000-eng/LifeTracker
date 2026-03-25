import type { JSX } from "react";
import Link from "next/link";
import { hobbyPresetLibrary } from "@lifekeeper/presets";
import { updateHobbyAction } from "../../../../actions";
import { HobbyWorkbench } from "../../../../../components/hobby-workbench";
import { ApiError, getHobbyDetail, getMe } from "../../../../../lib/api";

type EditHobbyPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function EditHobbyPage({ params }: EditHobbyPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
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

    const hobby = await getHobbyDetail(household.id, hobbyId);
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
            householdId={household.id}
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