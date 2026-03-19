import type { JSX } from "react";
import { EntryTimeline, EntryTipsSurface } from "../../../../../components/entry-system";
import {
  ApiError,
  getMe,
  getProjectDetail,
} from "../../../../../lib/api";

type ProjectEntriesPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectEntriesPage({ params, searchParams }: ProjectEntriesPageProps): Promise<JSX.Element> {
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
      <section id="project-entries">
        <EntryTipsSurface
          householdId={household.id}
          queries={[{ entityType: "project", entityId: projectId }]}
        />
        <EntryTimeline
          householdId={household.id}
          entityType="project"
          entityId={projectId}
          title="Project Journal"
          quickAddLabel="Entry"
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load entries: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}