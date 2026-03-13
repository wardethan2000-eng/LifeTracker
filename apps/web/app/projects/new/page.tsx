import Link from "next/link";
import type { JSX } from "react";
import { createProjectAction } from "../../actions";
import { AppShell } from "../../../components/app-shell";
import { ProjectCoreFormFields } from "../../../components/project-core-form-fields";
import { ApiError, getMe } from "../../../lib/api";

type NewProjectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProjectPage({ searchParams }: NewProjectPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;

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
          <form action={createProjectAction} className="asset-studio asset-studio--industrial project-creation-studio">
            <section className="panel panel--studio">
              <div className="panel-header">
                <div>
                  <h2>Project Setup</h2>
                  <p className="project-creation-studio__intro">Start with the operational basics, then layer in assets, tasks, inventory, and expenses after the project exists.</p>
                </div>
                <div className="panel-header__actions">
                  <button type="submit" className="button button--primary">Create Project</button>
                </div>
              </div>

              <ProjectCoreFormFields householdId={household.id} variant="studio" />
            </section>

            <section className="panel panel--studio">
              <div className="panel-header">
                <h2>What You Unlock Next</h2>
              </div>

              <div className="project-creation-studio__next-grid">
                <article className="asset-studio__field-card">
                  <div className="asset-studio__field-card-header">
                    <div>
                      <h3>Link Assets</h3>
                      <p>Attach the equipment, rooms, systems, or vehicles affected by the project.</p>
                    </div>
                  </div>
                </article>

                <article className="asset-studio__field-card">
                  <div className="asset-studio__field-card-header">
                    <div>
                      <h3>Build Tasks</h3>
                      <p>Break the work into sequenced tasks, owners, due dates, and tracked completion.</p>
                    </div>
                  </div>
                </article>

                <article className="asset-studio__field-card">
                  <div className="asset-studio__field-card-header">
                    <div>
                      <h3>Plan Phases</h3>
                      <p>Break the project into sequential phases with their own checklists, budgets, supply lists, and timelines.</p>
                    </div>
                  </div>
                </article>

                <article className="asset-studio__field-card">
                  <div className="asset-studio__field-card-header">
                    <div>
                      <h3>Reserve Inventory</h3>
                      <p>Convert required materials into project inventory lines and allocate stock from household inventory.</p>
                    </div>
                  </div>
                </article>

                <article className="asset-studio__field-card">
                  <div className="asset-studio__field-card-header">
                    <div>
                      <h3>Track Spend</h3>
                      <p>Add expenses, providers, and budget pressure as the project moves from planning into execution.</p>
                    </div>
                  </div>
                </article>
              </div>

              <div className="inline-actions inline-actions--end">
                <button type="submit" className="button button--primary">Create Project</button>
              </div>
            </section>
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