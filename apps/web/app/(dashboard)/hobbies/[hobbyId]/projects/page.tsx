import type { JSX } from "react";
import { Suspense } from "react";
import { HobbyProjectsTab } from "../../../../../components/hobby-projects-tab";
import {
  ApiError,
  getHobbyDetail,
  getMe,
  listHobbyProjects,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyProjectsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;
  const me = await getMe();
  const household = me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading projects…</div></div>}>
      <ProjectsContent householdId={household.id} hobbyId={hobbyId} />
    </Suspense>
  );
}

async function ProjectsContent({ householdId, hobbyId }: { householdId: string; hobbyId: string }): Promise<JSX.Element> {
  try {
    const [hobby, hobbyProjects] = await Promise.all([
      getHobbyDetail(householdId, hobbyId),
      listHobbyProjects(householdId, hobbyId, { limit: 100 }),
    ]);

    return <HobbyProjectsTab hobbyId={hobbyId} activityMode={hobby.activityMode} projects={hobbyProjects.items} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load projects: {error.message}</p></div></div>;
    }
    throw error;
  }
}