import Link from "next/link";
import { Suspense, type JSX } from "react";
import { HobbyAnalyticsWorkspace } from "../../../../components/hobby-analytics-workspace";
import { ApiError, getHouseholdHobbies, getMe } from "../../../../lib/api";

type HobbyAnalyticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

async function HobbyAnalyticsContent({ householdId, households, selectedHouseholdId }: { householdId: string; households: { id: string; name: string }[]; selectedHouseholdId: string }): Promise<JSX.Element> {
  let hobbies;
  try {
    hobbies = await getHouseholdHobbies(householdId);
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
          <h1>Hobby Analytics</h1>
          <p style={{ marginTop: 6 }}>Session trends, practice streaks, and goal tracking across your household&#39;s hobby workspaces.</p>
        </div>
        {households.length > 1 ? (
          <div className="household-switcher">
            {households.map((item) => (
              <Link
                key={item.id}
                href={`/analytics/hobbies?householdId=${item.id}`}
                className={`household-chip${item.id === selectedHouseholdId ? " household-chip--active" : ""}`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <div className="page-body">
        <HobbyAnalyticsWorkspace householdId={householdId} hobbies={hobbies} />
      </div>
    </>
  );
}

export default async function HobbyAnalyticsPage({ searchParams }: HobbyAnalyticsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const me = await getMe();
  const household = me.households.find((item) => item.id === getParam(params.householdId)) ?? me.households[0];

  if (!household) {
    return (
      <>
        <header className="page-header"><h1>Hobby Analytics</h1></header>
        <div className="page-body">
          <p>No household found. <Link href="/" className="text-link">Go to dashboard</Link> to create one.</p>
        </div>
      </>
    );
  }

  return (
    <Suspense fallback={<><header className="page-header"><h1>Hobby Analytics</h1></header><div className="page-body"><div className="panel"><div className="panel__body--padded"><p className="note">Loading analytics…</p></div></div></div></>}>
      <HobbyAnalyticsContent householdId={household.id} households={me.households} selectedHouseholdId={household.id} />
    </Suspense>
  );
}
