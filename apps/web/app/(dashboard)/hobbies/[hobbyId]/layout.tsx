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

  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview", href: base },
    { id: "sessions", label: "Sessions", href: `${base}/sessions` },
    { id: "practice", label: "Practice", href: `${base}/practice` },
    { id: "projects", label: "Projects", href: `${base}/projects` },
    { id: "collection", label: "Collection", href: `${base}/collection` },
    { id: "recipes", label: "Recipes", href: `${base}/recipes` },
    { id: "series", label: "Series", href: `${base}/series` },
    { id: "metrics", label: "Metrics", href: `${base}/metrics` },
    { id: "inventory", label: "Inventory", href: `${base}/inventory` },
    { id: "entries", label: "Notes", href: `${base}/entries` },
    { id: "canvas", label: "Canvas", href: `${base}/canvas` },
    { id: "activity", label: "Activity", href: `${base}/activity` },
    { id: "settings", label: "Settings", href: `${base}/settings` },
  ];

  const variant = hobbyStatusVariant[hobby.status];

  return (
    <WorkspaceLayout
      entityType="hobby"
      title={hobby.name}
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
