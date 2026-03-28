import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { updateHobbyRecipeAction } from "../../../../../../actions";
import { HobbyRecipeWorkbench } from "../../../../../../../components/hobby-recipe-workbench";
import { ApiError, getHobbyDetail, getHobbyRecipe, getMe } from "../../../../../../../lib/api";

type EditHobbyRecipePageProps = {
  params: Promise<{ hobbyId: string; recipeId: string }>;
};

export default async function EditHobbyRecipePage({ params }: EditHobbyRecipePageProps): Promise<JSX.Element> {
  const { hobbyId, recipeId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>Edit Recipe</h1></header>
        <div className="page-body"><p>No household found.</p></div>
      </>
    );
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading…</div></div>}>
      <EditRecipeContent householdId={household.id} hobbyId={hobbyId} recipeId={recipeId} />
    </Suspense>
  );
}

async function EditRecipeContent({ householdId, hobbyId, recipeId }: { householdId: string; hobbyId: string; recipeId: string }): Promise<JSX.Element> {
  try {
    const [hobby, recipe] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyRecipe(householdId, hobbyId, recipeId),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}/recipes/${recipeId}`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← {recipe.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>Edit Recipe</h1>
            <p style={{ marginTop: "4px" }}>{hobby.name}</p>
          </div>
        </header>

        <div className="page-body">
          <HobbyRecipeWorkbench
            mode="edit"
            householdId={householdId}
            hobbyId={hobbyId}
            updateAction={updateHobbyRecipeAction}
            initialRecipe={recipe}
            hobbyInventoryLinks={hobby.inventoryLinks}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Edit Recipe</h1></header>
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