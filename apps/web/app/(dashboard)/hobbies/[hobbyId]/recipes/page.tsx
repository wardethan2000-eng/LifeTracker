import type { JSX } from "react";
import { Suspense } from "react";
import { HobbyRecipeList } from "../../../../../components/hobby-recipe-list";
import {
  ApiError,
  getHobbyRecipes,
  getMe,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyRecipesPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading recipes…</div></div>}>
      <RecipesContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function RecipesContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const recipes = await getHobbyRecipes(householdId, hobbyId);
    return <HobbyRecipeList householdId={householdId} hobbyId={hobbyId} recipes={recipes} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load recipes: {error.message}</p></div></div>;
    }
    throw error;
  }
}