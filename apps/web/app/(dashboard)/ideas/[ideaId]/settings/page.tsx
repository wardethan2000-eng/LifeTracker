import type { JSX } from "react";
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

  const idea = await getIdea(household.id, ideaId);

  return (
    <IdeaSettingsTab
      householdId={household.id}
      ideaId={idea.id}
      ideaTitle={idea.title}
      isArchived={!!idea.archivedAt}
    />
  );
}
