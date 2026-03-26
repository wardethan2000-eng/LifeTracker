import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { WorkspaceLayout, type WorkspaceTab } from "../../../../components/workspace-layout";
import { getMe, getProjectDetail } from "../../../../lib/api";

type ProjectLayoutProps = {
  params: Promise<{ projectId: string }>;
  children: ReactNode;
};

const projectStatusLabels: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const projectStatusVariant: Record<string, "info" | "success" | "warning" | "muted" | "danger"> = {
  planning: "info",
  active: "success",
  on_hold: "warning",
  completed: "muted",
  cancelled: "danger",
};

export default async function ProjectLayout({ params, children }: ProjectLayoutProps): Promise<JSX.Element> {
  const { projectId } = await params;

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <>{children}</>;
  }

  let project;
  try {
    project = await getProjectDetail(household.id, projectId);
  } catch {
    return <>{children}</>;
  }

  const qs = `?householdId=${household.id}`;
  const base = `/projects/${project.id}`;

  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview", href: `${base}${qs}` },
    { id: "phases", label: "Plan", href: `${base}/phases${qs}` },
    { id: "canvas", label: "Canvas", href: `${base}/canvas${qs}` },
    { id: "notepad", label: "Notes", href: `${base}/notepad${qs}` },
    { id: "timeline", label: "Timeline", href: `${base}/timeline${qs}` },
    { id: "budget", label: "Budget", href: `${base}/budget${qs}` },
    { id: "supplies", label: "Materials", href: `${base}/supplies${qs}` },
    { id: "notes", label: "Log", href: `${base}/notes${qs}` },
    { id: "settings", label: "Settings", href: `${base}/settings${qs}` },
  ];

  const breadcrumbs = project.breadcrumbs?.length > 1
    ? project.breadcrumbs.map((crumb) => ({
      id: crumb.id,
      name: crumb.name,
      href: `/projects/${crumb.id}${qs}`,
    }))
    : undefined;

  const variant = projectStatusVariant[project.status];

  return (
    <WorkspaceLayout
      entityType="project"
      title={project.name}
      status={projectStatusLabels[project.status] ?? project.status}
      {...(variant ? { statusVariant: variant } : {})}
      {...(breadcrumbs ? { breadcrumbs } : {})}
      backHref={`/projects${qs}`}
      backLabel="All Projects"
      headerActions={
        <>
          <Link href={`/projects/new?householdId=${household.id}&parentProjectId=${project.id}`} className="button button--ghost button--sm">+ Sub-project</Link>
        </>
      }
      tabs={tabs}
    >
      {children}
    </WorkspaceLayout>
  );
}
