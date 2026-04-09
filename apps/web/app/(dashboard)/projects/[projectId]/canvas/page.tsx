import type { JSX } from "react";
import { Suspense } from "react";
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

  const me = await getMe();
  const household = me.households.find((h) => h.id === householdId) ?? me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <CanvasContent householdId={household.id} projectId={projectId} />
    </Suspense>
  );
}

async function CanvasContent({ householdId, projectId }: { householdId: string; projectId: string }): Promise<JSX.Element> {
  try {
    const canvases = await getCanvasesByEntityWithGeometry(householdId, "project", projectId);

    return (
      <section id="project-canvas" style={{ padding: "16px 0" }}>
        <ProjectCanvasList
          householdId={householdId}
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
