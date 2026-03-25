import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return <div className="page-body"><p>No household found.</p></div>;
    }

    const [hobby, project, workLogs, inventory] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbyProject(household.id, hobbyId, projectId),
      listHobbyProjectWorkLogs(household.id, hobbyId, projectId, { limit: 100 }),
      getHouseholdInventory(household.id, { limit: 200 }),
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
            householdId={household.id}
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