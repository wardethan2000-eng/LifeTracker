import type { JSX } from "react";
import Link from "next/link";
import { createHobbyRecipeAction } from "../../../../../actions";
import { HobbyRecipeWorkbench } from "../../../../../../components/hobby-recipe-workbench";
import { ApiError, getHobbyDetail, getMe } from "../../../../../../lib/api";

type NewHobbyRecipePageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function NewHobbyRecipePage({ params }: NewHobbyRecipePageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>New Recipe</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </>
      );
    }

    const hobby = await getHobbyDetail(household.id, hobbyId);

    return (
      <>
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=recipes`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← Back to {hobby.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>New Recipe</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbyRecipeWorkbench
            mode="create"
            householdId={household.id}
            hobbyId={hobbyId}
            createAction={createHobbyRecipeAction}
            initialRecipe={null}
            hobbyInventoryLinks={hobby.inventoryLinks}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>New Recipe</h1></header>
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