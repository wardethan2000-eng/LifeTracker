import type { JSX } from "react";
import { Suspense } from "react";
import {
  cloneProjectAction,
  saveProjectAsTemplateAction,
  updateProjectAction,
} from "../../../../actions";
import { ExpandableCard } from "../../../../../components/expandable-card";
import { ProjectCoreFormFields } from "../../../../../components/project-core-form-fields";
import { DemoteToIdeaButton } from "../../../../../components/demote-to-idea-button";
import { ProjectDangerActions } from "../../../../../components/project-danger-actions";
import {
  ApiError,
  getMe,
  getProjectDetail,
} from "../../../../../lib/api";
import { formatCurrency, formatDate } from "../../../../../lib/formatters";

type ProjectSettingsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const projectStatusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

export default async function ProjectSettingsPage({ params, searchParams }: ProjectSettingsPageProps): Promise<JSX.Element> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  const me = await getMe();
  const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{display:"grid",gap:12}}>{[1,2,3].map((i)=>(<div key={i} className="skeleton-bar" style={{width:"100%",height:52,borderRadius:6}}/>))}</div></section>}>
      <SettingsContent householdId={household.id} projectId={projectId} />
    </Suspense>
  );
}

async function SettingsContent({ householdId, projectId }: { householdId: string; projectId: string }): Promise<JSX.Element> {
  try {
    const project = await getProjectDetail(householdId, projectId);

    return (
      <div id="project-settings">
        <ExpandableCard
          title="Project Settings"
          modalTitle="Project Settings"
          previewContent={
            <div className="compact-preview">
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span className="compact-preview__pill">{projectStatusLabels[project.status] ?? project.status}</span>
                {project.startDate ? <span className="compact-preview__pill">Starts {formatDate(project.startDate, "—")}</span> : null}
                {project.targetEndDate ? <span className="compact-preview__pill">Target {formatDate(project.targetEndDate, "—")}</span> : null}
                {project.budgetAmount ? <span className="compact-preview__pill">{formatCurrency(project.budgetAmount, "$0")} budget</span> : null}
              </div>
            </div>
          }
        >
          <div>
            <ProjectCoreFormFields
              action={updateProjectAction}
              householdId={householdId}
              project={project}
              submitLabel="Save Project"
            />
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", display: "grid", gap: 16 }}>
              <form action={saveProjectAsTemplateAction} className="workbench-grid">
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>Save as Template</span>
                  <input name="templateName" defaultValue={`${project.name} Template`} required />
                </label>
                <label className="field field--full">
                  <span>Template Description</span>
                  <input name="templateDescription" defaultValue={project.description ?? ""} />
                </label>
                <label className="field field--full">
                  <span>Template Notes</span>
                  <textarea name="templateNotes" rows={2} defaultValue={project.notes ?? ""} />
                </label>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button type="submit" className="button button--ghost">Save Template</button>
                </div>
              </form>

              <form action={cloneProjectAction} className="workbench-grid">
                <input type="hidden" name="householdId" value={householdId} />
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>Clone Project</span>
                  <input name="name" defaultValue={`${project.name} Copy`} required />
                </label>
                <label className="field">
                  <span>Clone Start Date</span>
                  <input name="startDate" type="date" />
                </label>
                <label className="field">
                  <span>Clone Target End</span>
                  <input name="targetEndDate" type="date" />
                </label>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button type="submit" className="button button--ghost">Create Clone</button>
                </div>
              </form>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              <DemoteToIdeaButton
                householdId={householdId}
                sourceType="project"
                sourceId={project.id}
                sourceName={project.name}
              />
              <ProjectDangerActions householdId={householdId} projectId={project.id} />
            </div>
          </div>
        </ExpandableCard>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load settings: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }
}