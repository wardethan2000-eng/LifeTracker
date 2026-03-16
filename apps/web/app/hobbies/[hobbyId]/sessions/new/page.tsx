import type { JSX } from "react";
import Link from "next/link";
import { createHobbySessionAction } from "../../../../actions";
import { AppShell } from "../../../../../components/app-shell";
import { HobbySessionWorkbench } from "../../../../../components/hobby-session-workbench";
import { ApiError, getHobbyDetail, getHobbyRecipes, getMe } from "../../../../../lib/api";

type NewHobbySessionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function NewHobbySessionPage({ params }: NewHobbySessionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>New Session</h1></header>
          <div className="page-body"><p>No household found.</p></div>
        </AppShell>
      );
    }

    const [hobby, recipes] = await Promise.all([
      getHobbyDetail(household.id, hobbyId),
      getHobbyRecipes(household.id, hobbyId),
    ]);

    return (
      <AppShell activePath="/hobbies">
        <header className="page-header">
          <div>
            <Link href={`/hobbies/${hobbyId}?tab=sessions`} className="text-link" style={{ fontSize: "0.85rem" }}>
              ← Back to {hobby.name}
            </Link>
            <h1 style={{ marginTop: "4px" }}>New Session</h1>
          </div>
        </header>

        <div className="page-body">
          <HobbySessionWorkbench
            action={createHobbySessionAction}
            householdId={household.id}
            hobbyId={hobbyId}
            recipes={recipes}
          />
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <AppShell activePath="/hobbies">
          <header className="page-header"><h1>New Session</h1></header>
          <div className="page-body">
            <div className="panel">
              <div className="panel__body--padded">
                <p>Failed to load: {error.message}</p>
              </div>
            </div>
          </div>
        </AppShell>
      );
    }

    throw error;
  }
}