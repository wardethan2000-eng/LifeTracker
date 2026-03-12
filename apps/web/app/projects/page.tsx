import Link from "next/link";
import type { JSX } from "react";
import { AppShell } from "../../components/app-shell";
import { ApiError, getHouseholdProjects, getMe } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/formatters";

type ProjectsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const projectStatusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled"
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Projects</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </AppShell>
      );
    }

    const projects = await getHouseholdProjects(household.id);
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const completedProjects = projects.filter((project) => project.status === "completed").length;
    const totalBudget = projects.reduce((sum, project) => sum + (project.totalBudgeted ?? 0), 0);
    const totalSpent = projects.reduce((sum, project) => sum + project.totalSpent, 0);

    return (
      <AppShell activePath="/projects">
        <header className="page-header">
          <h1>Projects</h1>
          <div className="page-header__actions">
            <Link href={`/projects/new?householdId=${household.id}`} className="button">New Project</Link>
          </div>
        </header>

        <div className="page-body">
          <section className="stats-row">
            <div className="stat-card stat-card--accent">
              <span className="stat-card__label">Active Projects</span>
              <strong className="stat-card__value">{activeProjects}</strong>
              <span className="stat-card__sub">{projects.length} tracked total</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">Completed</span>
              <strong className="stat-card__value">{completedProjects}</strong>
              <span className="stat-card__sub">Closed bodies of work</span>
            </div>
            <div className="stat-card stat-card--warning">
              <span className="stat-card__label">Planned Budget</span>
              <strong className="stat-card__value">{formatCurrency(totalBudget, "$0.00")}</strong>
              <span className="stat-card__sub">Across visible projects</span>
            </div>
            <div className="stat-card stat-card--danger">
              <span className="stat-card__label">Actual Spend</span>
              <strong className="stat-card__value">{formatCurrency(totalSpent, "$0.00")}</strong>
              <span className="stat-card__sub">Tracked expense line items</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Household Projects ({projects.length})</h2>
            </div>
            <div className="panel__body">
              {projects.length === 0 ? (
                <p className="panel__empty">No projects found for this household yet. Create one to start tracking work, budgets, linked assets, and tasks.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Budget</th>
                      <th>Spent</th>
                      <th>Progress</th>
                      <th>Target End</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project.id}>
                        <td>
                          <div className="data-table__primary">{project.name}</div>
                          <div className="data-table__secondary">{project.description ?? "No description"}</div>
                        </td>
                        <td><span className="pill">{projectStatusLabels[project.status] ?? project.status}</span></td>
                        <td>{formatCurrency(project.totalBudgeted, "Unbudgeted")}</td>
                        <td>{formatCurrency(project.totalSpent, "$0.00")}</td>
                        <td>
                          <div className="data-table__primary">{project.percentComplete}% complete</div>
                          <div className="data-table__secondary">{project.completedTaskCount} of {project.taskCount} tasks</div>
                        </td>
                        <td>{formatDate(project.targetEndDate, "No target")}</td>
                        <td>
                          <Link
                            href={`/projects/${project.id}?householdId=${household.id}`}
                            className="data-table__link"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/projects">
          <header className="page-header"><h1>Projects</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load projects: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}