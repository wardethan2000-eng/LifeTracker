import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const recipes = await getHobbyRecipes(household.id, hobbyId);

    return <HobbyRecipeList householdId={household.id} hobbyId={hobbyId} recipes={recipes} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load recipes: {error.message}</p></div></div>;
    }
    throw error;
  }
}