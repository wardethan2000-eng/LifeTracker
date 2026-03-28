import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createProjectAction, createProjectFromTemplateAction } from "../../../actions";
import { ProjectCoreFormFields } from "../../../../components/project-core-form-fields";
import { TabNav } from "../../../../components/tab-nav";
import { ApiError, getMe, getProjectDetail, getProjectTemplates } from "../../../../lib/api";

type NewProjectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProjectPage({ searchParams }: NewProjectPageProps): Promise<JSX.Element> {
  const t = await getTranslations("projects");
  const tCommon = await getTranslations("common");
  const params = searchParams ? await searchParams : {};
  const householdId = typeof params.householdId === "string" ? params.householdId : undefined;
  const parentProjectId = typeof params.parentProjectId === "string" ? params.parentProjectId : undefined;
  const mode = params.mode === "template" ? "template" : "manual";

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === householdId) ?? me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>{t("newPageTitle")}</h1></header>
          <div className="page-body">
            <p>{tCommon("empty.noHousehold")} <Link href="/" className="text-link">{tCommon("actions.goToDashboard")}</Link> to create one.</p>
          </div>
        </>
      );
    }

    const buildPlanningHref = (planningMode: "manual" | "template"): string => {
      const query = new URLSearchParams({ householdId: household.id });
      if (parentProjectId) {
        query.set("parentProjectId", parentProjectId);
      }
      const basePath = planningMode === "template" ? "/projects/new/template" : "/projects/new";
      return `${basePath}?${query.toString()}`;
    };

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("newPageTitle")}</h1>
            <p style={{ marginTop: 6 }}>{t("newPageSubtitle")}</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">{tCommon("actions.backToProjects")}</Link>
          </div>
        </header>

        <TabNav
          ariaLabel="Planning sections"
          variant="pill"
          items={[
            {
              id: "manual",
              label: "Manual Plan",
              href: buildPlanningHref("manual"),
              active: mode === "manual",
            },
            {
              id: "template",
              label: "Saved Template",
              href: buildPlanningHref("template"),
              active: mode === "template",
            },
          ]}
        />

        <div className="page-body">
          <Suspense fallback={<div className="panel"><div className="panel__empty">Loading…</div></div>}>
            <NewProjectContent householdId={household.id} parentProjectId={parentProjectId} mode={mode} />
          </Suspense>
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

async function NewProjectContent({ householdId, parentProjectId, mode }: { householdId: string; parentProjectId: string | undefined; mode: string }): Promise<JSX.Element> {
  const parentProject = parentProjectId
    ? await getProjectDetail(householdId, parentProjectId).catch(() => null)
    : null;
  const projectTemplates = await getProjectTemplates(householdId).catch(() => []);

  return (
    <>
      {parentProjectId && parentProject && (
        <div className="note" style={{ marginBottom: 16 }}>
          Creating a sub-project under <Link href={`/projects/${parentProjectId}?householdId=${householdId}`} className="text-link"><strong>{parentProject.name}</strong></Link>
        </div>
      )}
      {mode === "template" ? (
        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel__header">
            <h2>Start From Saved Template</h2>
          </div>
          <div className="panel__body--padded" style={{ display: "grid", gap: 16 }}>
            {projectTemplates.length > 0 ? (
              <form action={createProjectFromTemplateAction} className="workbench-grid">
                <input type="hidden" name="householdId" value={householdId} />
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
            ) : (
              <p className="panel__empty">No saved templates are available yet. Use the manual page to build a project, then save it as a template from project settings.</p>
            )}
          </div>
        </section>
      ) : (
        <ProjectCoreFormFields
          action={createProjectAction}
          householdId={householdId}
          submitLabel="Create Project"
          cancelHref={`/projects?householdId=${householdId}`}
          {...(parentProjectId ? { parentProjectId } : {})}
        />
      )}
    </>
  );
}