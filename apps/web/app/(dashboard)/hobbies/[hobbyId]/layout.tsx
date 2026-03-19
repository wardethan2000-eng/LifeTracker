import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { WorkspaceLayout, type WorkspaceTab } from "../../../../components/workspace-layout";
import { getMe, getHobbyDetail } from "../../../../lib/api";

type HobbyLayoutProps = {
  params: Promise<{ hobbyId: string }>;
  children: ReactNode;
};

const hobbyStatusLabels: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

const hobbyStatusVariant: Record<string, "success" | "warning" | "muted"> = {
  active: "success",
  paused: "warning",
  archived: "muted",
};

export default async function HobbyLayout({ params, children }: HobbyLayoutProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <>{children}</>;
  }

  let hobby;
  try {
    hobby = await getHobbyDetail(household.id, hobbyId);
  } catch {
    return <>{children}</>;
  }

  const base = `/hobbies/${hobby.id}`;

  // Dynamic tab ordering based on activity mode
  const modeTabs: WorkspaceTab[] = [];
  if (hobby.activityMode === "project" || hobby.projectLinks.length > 0) {
    modeTabs.push({ id: "projects", label: "Projects", href: `${base}/projects` });
  }
  if (hobby.activityMode === "practice") {
    modeTabs.push({ id: "practice", label: "Practice", href: `${base}/practice` });
  }
  if (hobby.activityMode === "collection") {
    modeTabs.push({ id: "collection", label: "Collection", href: `${base}/collection` });
  }

  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview", href: base },
    ...modeTabs,
    { id: "recipes", label: "Recipes", href: `${base}/recipes`, show: hobby.recipeCount > 0 || hobby.activityMode === "session" },
    { id: "sessions", label: "Sessions", href: `${base}/sessions` },
    { id: "series", label: "Series", href: `${base}/series`, show: hobby.activityMode === "session" },
    { id: "inventory", label: "Inventory", href: `${base}/inventory`, show: hobby.inventoryLinks.length > 0 || hobby.inventoryCategories.length > 0 },
    { id: "metrics", label: "Metrics", href: `${base}/metrics`, show: hobby.metricDefinitions.length > 0 },
    { id: "entries", label: "Journal", href: `${base}/entries` },
    { id: "settings", label: "Settings", href: `${base}/settings` },
  ];

  const variant = hobbyStatusVariant[hobby.status];

  return (
    <WorkspaceLayout
      entityType="hobby"
      title={hobby.name}
      {...(hobby.description ? { description: hobby.description } : {})}
      status={hobbyStatusLabels[hobby.status] ?? hobby.status}
      {...(variant ? { statusVariant: variant } : {})}
      backHref="/hobbies"
      backLabel="All Hobbies"
      headerActions={
        <>
          <Link href={`${base}/sessions/new`} className="button button--primary button--sm">New Session</Link>
          <Link href={`${base}/edit`} className="button button--ghost button--sm">Edit Hobby</Link>
          {hobby.hobbyType ? <span className="pill">{hobby.hobbyType}</span> : null}
        </>
      }
      tabs={tabs}
    >
      {children}
    </WorkspaceLayout>
  );
}
