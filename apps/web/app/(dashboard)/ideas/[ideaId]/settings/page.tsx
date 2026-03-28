import type { JSX } from "react";
import { Suspense } from "react";
import { getIdea, getMe } from "../../../../../lib/api";
import { IdeaSettingsTab } from "../../../../../components/idea-settings-tab";

type IdeaSettingsPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaSettingsPage({ params }: IdeaSettingsPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;
  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found.</p>;
  }

  return (
    <Suspense fallback={<div className="panel"><div className="panel__empty">Loading settings…</div></div>}>
      <SettingsContent householdId={household.id} ideaId={ideaId} />
    </Suspense>
  );
}

async function SettingsContent({ householdId, ideaId }: { householdId: string; ideaId: string }): Promise<JSX.Element> {
  const idea = await getIdea(householdId, ideaId);

  return (
    <IdeaSettingsTab
      householdId={householdId}
      ideaId={idea.id}
      ideaTitle={idea.title}
      isArchived={!!idea.archivedAt}
    />
  );
}
