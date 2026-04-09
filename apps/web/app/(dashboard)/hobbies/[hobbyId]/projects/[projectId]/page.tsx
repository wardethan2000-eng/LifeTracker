import type { JSX } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { HobbyProjectDetailSurface } from "../../../../../../components/hobby-project-detail";
import {
  ApiError,
  getHobbyDetail,
  getHobbyProject,
  getHouseholdInventory,
  getMe,
  listHobbyProjectWorkLogs,
} from "../../../../../../lib/api";

type HobbyProjectDetailPageProps = {
  params: Promise<{ hobbyId: string; projectId: string }>;
};

export default async function HobbyProjectDetailPage({ params }: HobbyProjectDetailPageProps): Promise<JSX.Element> {
  const { hobbyId, projectId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) {
    return <div className="page-body"><p>No household found.</p></div>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <ProjectContent householdId={household.id} hobbyId={hobbyId} projectId={projectId} />
    </Suspense>
  );
}

async function ProjectContent({ householdId, hobbyId, projectId }: { householdId: string; hobbyId: string; projectId: string }): Promise<JSX.Element> {
  try {
    const [hobby, project, workLogs, inventory] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      getHobbyProject(householdId, hobbyId, projectId),
      listHobbyProjectWorkLogs(householdId, hobbyId, projectId, { limit: 100 }),
      getHouseholdInventory(householdId, { limit: 200 }),
    ]);

    return (
      <>
        <header className="page-header">
          <div>
            <div style={{ display: "grid", gap: "4px" }}>
              <Link href="/hobbies" className="text-link" style={{ fontSize: "0.85rem" }}>← All Hobbies</Link>
              <Link href={`/hobbies/${hobbyId}?tab=projects`} className="text-link" style={{ fontSize: "0.85rem" }}>← {hobby.name}</Link>
            </div>
            <h1 style={{ marginTop: "4px" }}>{project.name}</h1>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem" }}>{project.description ?? "No description."}</p>
          </div>
        </header>
        <div className="page-body">
          <HobbyProjectDetailSurface
            householdId={householdId}
            hobbyId={hobbyId}
            project={project}
            workLogs={workLogs.items}
            availableInventoryItems={inventory.items}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="page-body"><p>Failed to load: {error.message}</p></div>;
    }
    throw error;
  }
}