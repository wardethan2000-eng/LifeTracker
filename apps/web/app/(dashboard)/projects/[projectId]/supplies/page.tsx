import type { JSX } from "react";
import { Suspense } from "react";
import { ProjectSuppliesWorkspaceSection } from "../../../../../components/project-supplies-workspace-section";
import {
  ApiError,
  getMe,
} from "../../../../../lib/api";

type ProjectSuppliesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const SuppliesWorkspaceSkeleton = (): JSX.Element => (
  <div className="project-supplies-workspace">
    <section className="card">
      <div className="card__header">
        <div className="card__header-left">
          <h3>Supplies</h3>
        </div>
      </div>
      <div className="card__body">
        <div className="supply-stat-bar">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="supply-stat">
              <div className="skeleton-bar" style={{ width: 48, height: 18, margin: "0 auto" }} />
              <div className="skeleton-bar" style={{ width: 60, height: 10, margin: "4px auto 0" }} />
            </div>
          ))}
        </div>
      </div>
    </section>
    <div className="supply-filter-bar">
      <div className="skeleton-bar" style={{ flex: 1, height: 32, borderRadius: 6 }} />
      <div className="skeleton-bar" style={{ width: 120, height: 32, borderRadius: 6 }} />
      <div className="skeleton-bar" style={{ width: 120, height: 32, borderRadius: 6 }} />
    </div>
    {[1, 2].map((section) => (
      <div key={section} className="supply-section">
        <div className="supply-section__header" style={{ pointerEvents: "none" }}>
          <div className="skeleton-bar" style={{ width: 120, height: 16 }} />
          <div className="skeleton-bar" style={{ width: 40, height: 20, marginLeft: "auto" }} />
        </div>
      </div>
    ))}
  </div>
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
        <Suspense fallback={<SuppliesWorkspaceSkeleton />}>
          <ProjectSuppliesWorkspaceSection householdId={household.id} projectId={projectId} />
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