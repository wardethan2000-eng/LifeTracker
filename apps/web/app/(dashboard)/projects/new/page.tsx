import Link from "next/link";
import type { JSX } from "react";
import { createProjectAction, createProjectFromTemplateAction } from "../../../actions";
import { ProjectCoreFormFields } from "../../../../components/project-core-form-fields";
import { ApiError, getMe, getProjectDetail, getProjectTemplates } from "../../../../lib/api";

type NewProjectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProjectPage({ searchParams }: NewProjectPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const parentProjectId = typeof params.parentProjectId === "string" ? params.parentProjectId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>New Project</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const parentProject = parentProjectId
      ? await getProjectDetail(household.id, parentProjectId).catch(() => null)
      : null;
    const projectTemplates = await getProjectTemplates(household.id).catch(() => []);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Create Project</h1>
            <p style={{ marginTop: 6 }}>Track household work with a budget, timeline, linked assets, tasks, and expenses.</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">Back to Projects</Link>
          </div>
        </header>

        <div className="page-body">
          {parentProjectId && parentProject && (
            <div className="note" style={{ marginBottom: 16 }}>
              Creating a sub-project under <Link href={`/projects/${parentProjectId}?householdId=${household.id}`} className="text-link"><strong>{parentProject.name}</strong></Link>
            </div>
          )}
          {projectTemplates.length > 0 && (
            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="panel__header">
                <h2>Start From Saved Template</h2>
              </div>
              <div className="panel__body--padded" style={{ display: "grid", gap: 16 }}>
                <form action={createProjectFromTemplateAction} className="workbench-grid">
                  <input type="hidden" name="householdId" value={household.id} />
                  {parentProjectId ? <input type="hidden" name="parentProjectId" value={parentProjectId} /> : null}
                  <label className="field">
                    <span>Template</span>
                    <select name="templateId" defaultValue="" required>
                      <option value="" disabled>Select a saved template</option>
                      {projectTemplates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name} · {template.phaseCount} phases · {template.taskCount} tasks</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Project Name</span>
                    <input name="name" placeholder="Winterize 2026" required />
                  </label>
                  <label className="field">
                    <span>Start Date</span>
                    <input name="startDate" type="date" />
                  </label>
                  <label className="field">
                    <span>Target End Date</span>
                    <input name="targetEndDate" type="date" />
                  </label>
                  <div className="inline-actions" style={{ marginTop: 8 }}>
                    <button type="submit" className="button button--ghost">Create From Template</button>
                  </div>
                </form>
              </div>
            </section>
          )}
          <form action={createProjectAction} className="workbench-form">
            <ProjectCoreFormFields householdId={household.id} />
            {parentProjectId && <input type="hidden" name="parentProjectId" value={parentProjectId} />}
            <div className="workbench-bar">
              <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">Cancel</Link>
              <button type="submit" className="button button--primary">Create Project</button>
            </div>
          </form>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Create Project</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load project creation page: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}