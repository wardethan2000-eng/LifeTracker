import type { JSX } from "react";
import Link from "next/link";
import { updateHobbyRecipeAction } from "../../../../../actions";
import { AppShell } from "../../../../../../components/app-shell";
import { HobbyRecipeWorkbench } from "../../../../../../components/hobby-recipe-workbench";
import { ApiError, getHobbyDetail, getHobbyRecipe, getMe } from "../../../../../../lib/api";

type EditHobbyRecipePageProps = {
  params: Promise<{ hobbyId: string; recipeId: string }>;
};

export default async function EditHobbyRecipePage({ params }: EditHobbyRecipePageProps): Promise<JSX.Element> {
  const { hobbyId, recipeId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Edit Recipe</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </AppShell>
      );
    }

    const [hobby, recipe] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbyRecipe(household.id, hobbyId, recipeId),
    ]);

    return (
      <AppShell activePath="/hobbies">
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}/recipes/${recipeId}`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← Back to {recipe.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>Edit Recipe</h1>
            <p style={{ marginTop: "4px" }}>{hobby.name}</p>
          </div>
        </header>

        <div className="page-body">
          <HobbyRecipeWorkbench
            mode="edit"
            householdId={household.id}
            hobbyId={hobbyId}
            updateAction={updateHobbyRecipeAction}
            initialRecipe={recipe}
            hobbyInventoryLinks={hobby.inventoryLinks}
          />
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>Edit Recipe</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}