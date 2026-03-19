import type { JSX } from "react";
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

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const [hobby, hobbyProjects] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      listHobbyProjects(household.id, hobbyId, { limit: 100 }),
    ]);

    return <HobbyProjectsTab hobbyId={hobbyId} activityMode={hobby.activityMode} projects={hobbyProjects.items} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load projects: {error.message}</p></div></div>;
    }
    throw error;
  }
}