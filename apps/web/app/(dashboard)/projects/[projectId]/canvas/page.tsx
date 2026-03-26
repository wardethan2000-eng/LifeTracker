import type { JSX } from "react";
import { ApiError, getCanvasesByEntityWithGeometry, getMe } from "../../../../../lib/api";
import { ProjectCanvasList } from "../../../../../components/project-canvas-list";

type ProjectCanvasPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectCanvasPage({
  params,
  searchParams,
}: ProjectCanvasPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((h) => h.id === householdId) ?? me.households[0];

    if (!household) {
      return <p>No household found.</p>;
    }

    const canvases = await getCanvasesByEntityWithGeometry(household.id, "project", projectId);

    return (
      <section id="project-canvas" style={{ padding: "16px 0" }}>
        <ProjectCanvasList
          householdId={household.id}
          projectId={projectId}
          initialCanvases={canvases}
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load canvases: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
