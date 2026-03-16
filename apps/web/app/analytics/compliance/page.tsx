import Link from "next/link";
import type { JSX } from "react";
import { ComplianceAnalyticsWorkspace } from "../../../components/compliance-analytics-workspace";
import { ApiError, getHouseholdAssets, getMe } from "../../../lib/api";

type ComplianceAnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

export default async function ComplianceAnalyticsPage({ searchParams }: ComplianceAnalyticsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};

  try {
    const me = await getMe();
    const household = me.households.find((item) => item.id === getParam(params.householdId)) ?? me.households[0];

    if (!household) {
      return (
        <>
          <header className="page-header"><h1>Schedule &amp; Compliance Analytics</h1></header>
          <div className="page-body">
            <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
          </div>
        </>
      );
    }

    const assets = await getHouseholdAssets(household.id);

    return (
      <>
        <header className="page-header">
          <div>
            <h1>Schedule &amp; Compliance Analytics</h1>
            <p style={{ marginTop: 6 }}>
              Track on-time execution, overdue drift, category blind spots, and regulatory readiness without altering maintenance records.
            </p>
          </div>
          {me.households.length > 1 ? (
            <div className="household-switcher">
              {me.households.map((item) => (
                <Link
                  key={item.id}
                  href={`/analytics/compliance?householdId=${item.id}`}
                  className={`household-chip${item.id === household.id ? " household-chip--active" : ""}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          ) : null}
        </header>

        <div className="page-body">
          <ComplianceAnalyticsWorkspace householdId={household.id} assets={assets} />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <header className="page-header"><h1>Schedule &amp; Compliance Analytics</h1></header>
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