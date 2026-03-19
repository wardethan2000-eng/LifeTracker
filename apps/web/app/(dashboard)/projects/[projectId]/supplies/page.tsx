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
  <section className="card">
    <div className="card__header">
      <div className="card__header-left">
        <h3>Supplies Workspace</h3>
      </div>
    </div>
    <div className="card__body">
      <div className="project-supplies-workspace__summary">
        {[1, 2, 3, 4].map((row) => (
          <div key={row}>
            <span><div className="skeleton-bar" style={{ width: 90, height: 10 }} /></span>
            <strong><div className="skeleton-bar" style={{ width: 48, height: 16, marginTop: 8 }} /></strong>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        {[1, 2, 3].map((section) => (
          <div key={section} className="supply-section">
            <div className="supply-section__header" style={{ pointerEvents: "none" }}>
              <div className="skeleton-bar" style={{ width: 120, height: 16 }} />
              <div className="skeleton-bar" style={{ width: 40, height: 20 }} />
            </div>
            <div className="supply-section__body">
              <div className="skeleton-bar" style={{ width: "100%", height: 110 }} />
              <div className="skeleton-bar" style={{ width: "100%", height: 110 }} />
            </div>
          </div>
        ))}
      </div>
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