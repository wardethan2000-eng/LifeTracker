import { EntryTimeline } from "./entry-system";

type SessionActivityLogSectionProps = {
  householdId: string;
  hobbyId: string;
  sessionId: string;
};

export function SessionActivityLogSection({ householdId, hobbyId, sessionId }: SessionActivityLogSectionProps): JSX.Element {
  return (
    <EntryTimeline
      householdId={householdId}
      entityType="hobby_session"
      entityId={sessionId}
      title="Entry Timeline"
      quickAddLabel="Entry"
      entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/sessions/${sessionId}#entry-${entry.id}`}
    />
  );
}