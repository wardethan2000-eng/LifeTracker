import type { JSX } from "react";
import Link from "next/link";
import {
  ApiError,
  getHobbyDetail,
  getHobbySessions,
  getHobbySeries,
  getEntries,
  getMe,
  getSourceIdea,
  listHobbyPracticeGoals,
  listHobbyPracticeRoutines,
} from "../../../../lib/api";
import { HobbyDashboard } from "../../../../components/hobby-dashboard";
import { IdeaProvenanceBar } from "../../../../components/idea-provenance-bar";

type HobbyDetailPageProps = {
  params: Promise<{ hobbyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HobbyDetailPage({ params }: HobbyDetailPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) {
      return <p>No household found.</p>;
    }

    const [hobby, sessions, series, entriesResult, sourceIdea, goalsResult, routinesResult] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbySessions(household.id, hobbyId),
      getHobbySeries(household.id, hobbyId),
      getEntries(household.id, {
        entityType: "hobby",
        entityId: hobbyId,
        limit: 5,
        sortBy: "entryDate",
        excludeFlags: ["archived"],
      }).catch(() => ({ items: [], nextCursor: null })),
      getSourceIdea(household.id, "hobby", hobbyId).catch(() => null),
      listHobbyPracticeGoals(household.id, hobbyId, { limit: 10, status: "active" }).catch(() => ({ items: [], nextCursor: null })),
      listHobbyPracticeRoutines(household.id, hobbyId, { limit: 10, isActive: true }).catch(() => ({ items: [], nextCursor: null })),
    ]);

    const activeSessions = sessions.filter((s) => s.status !== "completed" && s.status !== "cancelled");
    const completedSessions = sessions.filter((s) => s.status === "completed");

    const recentEntries = entriesResult.items
      .filter((e) => !(e.tags ?? []).includes("dashboard_notepad"))
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title ?? "",
        entryDate: e.entryDate,
      }));

    return (
      <>
        {sourceIdea && (
          <IdeaProvenanceBar ideaId={sourceIdea.id} ideaTitle={sourceIdea.title} />
        )}
        <HobbyDashboard
        householdId={household.id}
        hobbyId={hobbyId}
        hobbyName={hobby.name}
        status={hobby.status}
        hobbyType={hobby.hobbyType ?? null}
        activityMode={hobby.activityMode}
        lifecycleMode={hobby.lifecycleMode}
        sessionCount={hobby.sessionCount}
        recipeCount={hobby.recipeCount}
        seriesCount={series.length}
        activeSessions={activeSessions.slice(0, 5).map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          recipeName: s.recipeName ?? null,
          startDate: s.startDate ?? null,
          completedDate: null,
          rating: null,
          completedStepCount: s.completedStepCount,
          stepCount: s.stepCount,
        }))}
        recentSessions={completedSessions.slice(0, 5).map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          recipeName: s.recipeName ?? null,
          startDate: s.startDate ?? null,
          completedDate: s.completedDate ?? null,
          rating: s.rating ?? null,
          completedStepCount: s.completedStepCount,
          stepCount: s.stepCount,
        }))}
        equipment={hobby.assetLinks.map((link) => ({
          id: link.id,
          assetId: link.assetId,
          assetName: link.asset.name,
          role: link.role ?? null,
        }))}
        recentEntries={recentEntries}
        activeGoals={goalsResult.items.slice(0, 3)}
        topRoutines={routinesResult.items.slice(0, 3)}
      />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
