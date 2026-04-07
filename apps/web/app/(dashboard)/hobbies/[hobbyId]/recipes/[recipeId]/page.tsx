import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import {
  createSessionFromRecipeAction,
  deleteHobbyRecipeAction,
} from "../../../../../actions";
import { HobbyRecipeDeleteButton } from "../../../../../../components/hobby-recipe-delete-button";
import { ApiError, getHobbyDetail, getHobbyRecipe, getMe } from "../../../../../../lib/api";
import { formatDate } from "../../../../../../lib/formatters";

type HobbyRecipeDetailPageProps = {
  params: Promise<{ hobbyId: string; recipeId: string }>;
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

const formatCustomFieldLabel = (key: string): string => key
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[_-]+/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const formatCustomFieldValue = (value: unknown): string => {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatCustomFieldValue(item)).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return value == null ? "-" : String(value);
};

export default async function HobbyRecipeDetailPage({ params }: HobbyRecipeDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, recipeId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>Recipe</h1></header>
        <div className="page-body"><p>No household found.</p></div>
      </>
    );
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <RecipeContent householdId={household.id} hobbyId={hobbyId} recipeId={recipeId} timezone={household.timezone} />
    </Suspense>
  );
}

async function RecipeContent({ householdId, hobbyId, recipeId, timezone }: { householdId: string; hobbyId: string; recipeId: string; timezone: string }): Promise<JSX.Element> {
  try {
    const [hobby, recipe] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyRecipe(householdId, hobbyId, recipeId),
    ]);
    const customFieldEntries = Object.entries(recipe.customFields ?? {});
    const sortedIngredients = [...recipe.ingredients].sort((left, right) => left.sortOrder - right.sortOrder);
    const sortedSteps = [...recipe.steps].sort((left, right) => left.sortOrder - right.sortOrder);

    return (
      <>
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=recipes`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← {hobby.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>{recipe.name}</h1>
            {recipe.styleCategory ? <p style={{ marginTop: "4px" }}>{recipe.styleCategory}</p> : null}
          </div>

          <div className="page-header__actions">
            <Link href={`/hobbies/${hobbyId}/recipes/${recipeId}/edit`} className="button button--secondary">
              Edit
            </Link>
            <HobbyRecipeDeleteButton
              householdId={household.id}
              hobbyId={hobbyId}
              recipeId={recipeId}
              deleteAction={deleteHobbyRecipeAction}
            />
          </div>
        </header>

        <div className="page-body">
          <div className="resource-layout">
            <div className="resource-layout__primary">
              <section className="panel">
                <div className="panel__header"><h2>Recipe Metadata</h2></div>
                <div className="panel__body--padded">
                  <dl className="kv-grid">
                    <div>
                      <dt>Description</dt>
                      <dd>{recipe.description ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Yield</dt>
                      <dd>{recipe.yield ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Estimated Duration</dt>
                      <dd>{recipe.estimatedDuration ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Estimated Cost</dt>
                      <dd>{recipe.estimatedCost == null ? "-" : currencyFormatter.format(recipe.estimatedCost)}</dd>
                    </div>
                    <div>
                      <dt>Notes</dt>
                      <dd>{recipe.notes ?? "-"}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>Ingredients</h2>
                  <span className="card__header-note">{sortedIngredients.length} total</span>
                </div>
                <div className="panel__body--flush">
                  <table className="data-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Category</th>
                        <th>Linked Inventory Item</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedIngredients.length === 0 ? (
                        <tr>
                          <td colSpan={7}>No ingredients saved for this recipe yet.</td>
                        </tr>
                      ) : sortedIngredients.map((ingredient, index) => {
                        const linkedInventoryItem = ingredient.inventoryItemId
                          ? hobby.inventoryLinks.find((link) => link.inventoryItemId === ingredient.inventoryItemId)?.inventoryItem.name ?? "-"
                          : "-";

                        return (
                          <tr key={ingredient.id}>
                            <td>{ingredient.sortOrder + 1 || index + 1}</td>
                            <td>{ingredient.name}</td>
                            <td>{ingredient.quantity}</td>
                            <td>{ingredient.unit}</td>
                            <td>{ingredient.category ?? "-"}</td>
                            <td>{linkedInventoryItem}</td>
                            <td>{ingredient.notes ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel">
                <div className="panel__header">
                  <h2>Steps</h2>
                  <span className="card__header-note">{sortedSteps.length} total</span>
                </div>
                <div className="panel__body--padded" style={{ display: "grid", gap: "0" }}>
                  {sortedSteps.length === 0 ? (
                    <p className="panel__empty">No steps saved for this recipe yet.</p>
                  ) : sortedSteps.map((step, index) => (
                    <div key={step.id} className="recipe-step-item">
                      <div className="recipe-step-item__number">{index + 1}</div>
                      <div style={{ flex: 1, display: "grid", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong>{step.title}</strong>
                          <span className="pill">{step.stepType}</span>
                          {step.durationMinutes != null ? <span className="pill">{step.durationMinutes} min</span> : null}
                        </div>
                        {step.description ? <p>{step.description}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="resource-layout__aside">
              <section className="panel">
                <div className="panel__header"><h2>Recipe Info</h2></div>
                <div className="panel__body--padded">
                  <dl className="data-list">
                    <div><dt>Source</dt><dd><span className="pill">{recipe.sourceType}</span></dd></div>
                    <div><dt>Created</dt><dd>{formatDate(recipe.createdAt, "-", timezone)}</dd></div>
                    <div><dt>Updated</dt><dd>{formatDate(recipe.updatedAt, "-", timezone)}</dd></div>
                    <div><dt>Sessions</dt><dd>Used in {recipe.sessionCount} sessions</dd></div>
                    <div><dt>Status</dt><dd>{recipe.isArchived ? "Archived" : "Active"}</dd></div>
                  </dl>
                </div>
              </section>

              {customFieldEntries.length > 0 ? (
                <section className="panel">
                  <div className="panel__header"><h2>Custom Fields</h2></div>
                  <div className="panel__body--padded recipe-custom-fields">
                    <dl className="kv-grid">
                      {customFieldEntries.map(([key, value]) => (
                        <div key={key}>
                          <dt>{formatCustomFieldLabel(key)}</dt>
                          <dd>{formatCustomFieldValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              ) : null}

              <section className="panel">
                <div className="panel__header"><h2>Actions</h2></div>
                <div className="panel__body--padded">
                  <form action={createSessionFromRecipeAction}>
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="hobbyId" value={hobbyId} />
                    <input type="hidden" name="recipeId" value={recipeId} />
                    <input type="hidden" name="recipeName" value={recipe.name} />
                    <button type="submit" className="button button--primary" style={{ width: "100%" }}>
                      Start Session from Recipe
                    </button>
                  </form>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Recipe</h1></header>
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