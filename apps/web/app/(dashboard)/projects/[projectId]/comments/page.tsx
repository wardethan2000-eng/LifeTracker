import type { JSX } from "react";
import { Suspense } from "react";
import { ApiError, getMe, getProjectComments, getProjectDetail } from "../../../../../lib/api";
import {
  createProjectCommentAction,
  deleteProjectCommentAction,
  updateProjectCommentAction,
} from "../../../../actions";
import { EntityComments } from "../../../../../components/entity-comments";

type ProjectCommentsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectCommentsPage({ params, searchParams }: ProjectCommentsPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdIdParam = typeof query.householdId === "string" ? query.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((h) => h.id === householdIdParam) ?? me.households[0];
  if (!household) return <p>No household found.</p>;

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <CommentsContent householdId={household.id} projectId={projectId} />
    </Suspense>
  );
}

async function CommentsContent({ householdId, projectId }: { householdId: string; projectId: string }): Promise<JSX.Element> {
  try {
    const [, comments] = await Promise.all([
      getProjectDetail(householdId, projectId),
      getProjectComments(householdId, projectId),
    ]);

    return (
      <section id="project-comments" style={{ padding: "16px 0" }}>
        <EntityComments
          comments={comments}
          config={{
            hiddenFields: { householdId, projectId },
            createAction: createProjectCommentAction,
            updateAction: updateProjectCommentAction,
            deleteAction: deleteProjectCommentAction,
          }}
          addCommentPlaceholder="Share updates, decisions, or handoff notes for the team…"
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load comments: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}
