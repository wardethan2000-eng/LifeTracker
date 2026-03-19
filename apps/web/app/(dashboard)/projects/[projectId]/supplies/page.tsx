import type { JSX } from "react";
import { Suspense } from "react";
import { ProjectShoppingListSection } from "../../../../../components/project-shopping-list-section";
import {
  ApiError,
  getMe,
  getProjectDetail,
} from "../../../../../lib/api";

type ProjectSuppliesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ShoppingListSkeleton = (): JSX.Element => (
  <section className="panel">
    <div className="panel__header">
      <h2>Shopping List</h2>
    </div>
    <div className="panel__body">
      <table className="data-table">
        <thead>
          <tr>
            <th>Supply</th>
            <th>Qty Remaining</th>
            <th>Unit Cost</th>
            <th>Line Cost</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((row) => (
            <tr key={row}>
              <td><div className="skeleton-bar" style={{ width: 180, height: 14 }} /></td>
              <td><div className="skeleton-bar" style={{ width: 90, height: 14 }} /></td>
              <td><div className="skeleton-bar" style={{ width: 80, height: 14 }} /></td>
              <td><div className="skeleton-bar" style={{ width: 80, height: 14 }} /></td>
              <td><div className="skeleton-bar" style={{ width: 72, height: 22 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default async function ProjectSuppliesPage({ params, searchParams }: ProjectSuppliesPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    return (
      <div id="project-shopping">
        <Suspense fallback={<ShoppingListSkeleton />}>
          <ProjectShoppingListSection householdId={household.id} projectId={projectId} />
        </Suspense>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load supplies: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}