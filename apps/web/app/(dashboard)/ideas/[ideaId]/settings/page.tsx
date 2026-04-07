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
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
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
