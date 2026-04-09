"use client";

import type { HobbyRecipe } from "@aegis/types";
import type { JSX } from "react";
import Link from "next/link";
import { EmptyState } from "./empty-state";
import { createSessionFromRecipeAction } from "../app/actions";
import { HobbyShoppingListButton } from "./hobby-shopping-list-button";
import {
  SectionFilterBar,
  SectionFilterChildren,
  SectionFilterProvider,
  SectionFilterToggle
} from "./section-filter";

type HobbyRecipeListProps = {
  householdId: string;
  hobbyId: string;
  recipes: HobbyRecipe[];
};

export function HobbyRecipeList({ householdId, hobbyId, recipes }: HobbyRecipeListProps): JSX.Element {
  return (
    <SectionFilterProvider items={recipes} keys={["name", "description"]} placeholder="Filter recipes by name or notes">
      <div style={{ display: "grid", gap: "16px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Recipes</h2>
            <div className="panel__header-actions">
              <SectionFilterToggle />
              <Link href={`/hobbies/${hobbyId}/recipes/new`} className="button button--primary button--sm">New Recipe</Link>
            </div>
          </div>
          <SectionFilterBar />
          <div className="panel__body--padded">
            <SectionFilterChildren<HobbyRecipe>>
              {(filteredRecipes) => (
                <>
                  {recipes.length === 0 ? <EmptyState icon="beaker" title="No recipes yet" message="Create your first recipe to start tracking your work." actionLabel="New Recipe" actionHref={`/hobbies/${hobbyId}/recipes/new`} /> : null}
                  {recipes.length > 0 && filteredRecipes.length === 0 ? <p className="panel__empty">No recipes match that search.</p> : null}
                  {filteredRecipes.length > 0 ? (
                    <div style={{ display: "grid", gap: "12px" }}>
                      {filteredRecipes.map((recipe) => (
                        <div key={recipe.id} className="hobby-recipe-card">
                          <Link href={`/hobbies/${hobbyId}/recipes/${recipe.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <strong>{recipe.name}</strong>
                                {recipe.styleCategory ? <span className="pill" style={{ marginLeft: "8px" }}>{recipe.styleCategory}</span> : null}
                              </div>
                              <span className="pill">{recipe.sourceType}</span>
                            </div>
                            {recipe.description ? (
                              <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "8px" }}>
                                {recipe.description.length > 120 ? `${recipe.description.slice(0, 120)}...` : recipe.description}
                              </p>
                            ) : null}
                            <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                              {recipe.estimatedDuration != null ? <span>{recipe.estimatedDuration} min</span> : null}
                              {recipe.estimatedCost != null ? <span>${recipe.estimatedCost.toFixed(2)}</span> : null}
                            </div>
                          </Link>
                          <div className="recipe-card__actions">
                            <Link href={`/hobbies/${hobbyId}/recipes/${recipe.id}`} className="button button--ghost button--sm">View Recipe</Link>
                            <Link href={`/hobbies/${hobbyId}/recipes/${recipe.id}/edit`} className="button button--secondary button--sm">Edit</Link>
                            <form action={createSessionFromRecipeAction}>
                              <input type="hidden" name="householdId" value={householdId} />
                              <input type="hidden" name="hobbyId" value={hobbyId} />
                              <input type="hidden" name="recipeId" value={recipe.id} />
                              <input type="hidden" name="recipeName" value={recipe.name} />
                              <button type="submit" className="button button--primary button--sm">Start Session</button>
                            </form>
                            <HobbyShoppingListButton
                              householdId={householdId}
                              hobbyId={hobbyId}
                              recipeId={recipe.id}
                              recipeName={recipe.name}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </SectionFilterChildren>
          </div>
        </section>
      </div>
    </SectionFilterProvider>
  );
}