import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createProjectAction, createProjectFromTemplateAction } from "../../../actions";
import { ProjectCreationWizard } from "../../../../components/project-creation-wizard";
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

    return (
      <>
        <header className="page-header">
          <div>
            <h1>{t("newPageTitle")}</h1>
            <p style={{ marginTop: 6 }}>Set up the project in a guided flow instead of sorting through every field at once.</p>
          </div>
          <div className="page-header__actions">
            <Link href={`/projects?householdId=${household.id}`} className="button button--ghost">{tCommon("actions.backToProjects")}</Link>
          </div>
        </header>

        <div className="page-body">
          <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
            <NewProjectContent householdId={household.id} parentProjectId={parentProjectId} />
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

async function NewProjectContent({ householdId, parentProjectId }: { householdId: string; parentProjectId: string | undefined }): Promise<JSX.Element> {
  const parentProject = parentProjectId
    ? await getProjectDetail(householdId, parentProjectId).catch(() => null)
    : null;
  const projectTemplates = await getProjectTemplates(householdId).catch(() => []);

  return (
    <ProjectCreationWizard
      createAction={createProjectAction}
      createFromTemplateAction={createProjectFromTemplateAction}
      householdId={householdId}
      projectTemplates={projectTemplates}
      cancelHref={`/projects?householdId=${householdId}`}
      parentProjectName={parentProject?.name ?? null}
      {...(parentProjectId ? { parentProjectId } : {})}
    />
  );
}
