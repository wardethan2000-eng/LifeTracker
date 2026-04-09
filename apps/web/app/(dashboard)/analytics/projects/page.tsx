import Link from "next/link";
import { Suspense, type JSX } from "react";
import { ProjectAnalyticsWorkspace } from "../../../../components/project-analytics-workspace";
import { ApiError, getHouseholdProjects, getMe } from "../../../../lib/api";

type ProjectAnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

async function ProjectAnalyticsContent({ householdId, households, selectedHouseholdId }: { householdId: string; households: { id: string; name: string }[]; selectedHouseholdId: string }): Promise<JSX.Element> {
  let projects;
  try {
    projects = await getHouseholdProjects(householdId);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load: {error.message}</p>
          </div>
        </div>
      );
    }
    throw error;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Project Analytics</h1>
          <p style={{ marginTop: 6 }}>Track delivery timing, budget burn, and portfolio risk without modifying the live project workspace.</p>
        </div>
        {households.length > 1 ? (
          <div className="household-switcher">
            {households.map((item) => (
              <Link
                key={item.id}
                href={`/analytics/projects?householdId=${item.id}`}
                className={`household-chip${item.id === selectedHouseholdId ? " household-chip--active" : ""}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <div className="page-body">
        <ProjectAnalyticsWorkspace householdId={householdId} projects={projects} />
      </div>
    </>
  );
}

export default async function ProjectAnalyticsPage({ searchParams }: ProjectAnalyticsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const me = await getMe();
  const household = me.households.find((item) => item.id === getParam(params.householdId)) ?? me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>Project Analytics</h1></header>
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <Suspense fallback={<><header className="page-header"><h1>Project Analytics</h1></header><div className="page-body"><div className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 16 }}><div className="skeleton-bar" style={{ width: "100%", height: 180, borderRadius: 8 }} /><div style={{ display: "flex", gap: 8 }}>{[1,2,3,4].map((i) => <div key={i} className="skeleton-bar" style={{ flex: 1, height: 56, borderRadius: 8 }} />)}</div><div className="skeleton-bar" style={{ width: "100%", height: 120, borderRadius: 8 }} /></div></div></div></>}>
      <ProjectAnalyticsContent householdId={household.id} households={me.households} selectedHouseholdId={household.id} />
    </Suspense>
  );
}