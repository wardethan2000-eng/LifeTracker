import Link from "next/link";
import type { JSX } from "react";
import { createProjectAction } from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { ProjectCoreFormFields } from "../../../components/project-core-form-fields";
import { ApiError, getMe, getProjectDetail } from "../../../lib/api";

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
        <AppShell activePath="/projects">
          <header className="page-header"><h1>New Project</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const parentProject = parentProjectId
      ? await getProjectDetail(household.id, parentProjectId).catch(() => null)
      : null;

    return (
      <AppShell activePath="/projects">
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
          <form action={createProjectAction} className="workbench-form">
            <ProjectCoreFormFields householdId={household.id} />
            {parentProjectId && <input type="hidden" name="parentProjectId" value={parentProjectId} />}
            <div className="workbench-bar">
              <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">Cancel</Link>
              <button type="submit" className="button button--primary">Create Project</button>
            </div>
          </form>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Create Project</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load project creation page: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}