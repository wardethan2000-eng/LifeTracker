import Link from "next/link";
import type { JSX } from "react";
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

export default async function ProjectAnalyticsPage({ searchParams }: ProjectAnalyticsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};

  try {
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

    const projects = await getHouseholdProjects(household.id);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Project Analytics</h1>
            <p style={{ marginTop: 6 }}>Track delivery timing, budget burn, and portfolio risk without modifying the live project workspace.</p>
          </div>
          {me.households.length > 1 ? (
            <div className="household-switcher">
              {me.households.map((item) => (
                <Link
                  key={item.id}
                  href={`/analytics/projects?householdId=${item.id}`}
                  className={`household-chip${item.id === household.id ? " household-chip--active" : ""}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          ) : null}
        </header>

        <div className="page-body">
          <ProjectAnalyticsWorkspace householdId={household.id} projects={projects} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Project Analytics</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    throw error;
  }
}