import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { WorkspaceLayout, type WorkspaceTab } from "../../../../components/workspace-layout";
import { ApiError, getIdea, getMe } from "../../../../lib/api";

type IdeaLayoutProps = {
  params: Promise<{ ideaId: string }>;
  children: ReactNode;
};

const stageLabels: Record<string, string> = {
  spark: "Spark",
  developing: "Developing",
  ready: "Ready",
};

const stageVariant: Record<string, "warning" | "info" | "success" | "muted"> = {
  spark: "warning",
  developing: "info",
  ready: "success",
};

export default async function IdeaLayout({ params, children }: IdeaLayoutProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <>{children}</>;
  }

  let idea;
  try {
    idea = await getIdea(household.id, ideaId);
  } catch (error) {
    if (error instanceof ApiError) {
      return <>{children}</>;
    }
    throw error;
  }

  const base = `/ideas/${idea.id}`;

  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview", href: base },
    { id: "notes", label: "Notes", href: `${base}/notes` },
    { id: "canvas", label: "Canvas", href: `${base}/canvas` },
    { id: "activity", label: "Activity", href: `${base}/activity` },
    { id: "settings", label: "Settings", href: `${base}/settings` },
  ];

  const variant = stageVariant[idea.stage];

  return (
    <WorkspaceLayout
      entityType="idea"
      title={idea.title}
      status={idea.archivedAt ? "Archived" : (stageLabels[idea.stage] ?? idea.stage)}
      {...(idea.archivedAt ? { statusVariant: "muted" as const } : variant ? { statusVariant: variant } : {})}
      backHref="/ideas"
      backLabel="All Ideas"
      headerActions={
        <>
          {!idea.archivedAt && (
            <Link href={`${base}/edit`} className="button button--ghost button--sm">Edit</Link>
          )}
          {idea.category && <span className="pill">{idea.category.replace(/_/g, " ")}</span>}
        </>
      }
      tabs={tabs}
    >
      {children}
    </WorkspaceLayout>
  );
}
