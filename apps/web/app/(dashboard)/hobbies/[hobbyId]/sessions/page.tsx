import type { JSX } from "react";
import { HobbySessionList } from "../../../../../components/hobby-session-list";
import {
  ApiError,
  getHobbySessions,
  getMe,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbySessionsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const sessions = await getHobbySessions(household.id, hobbyId);

    return <HobbySessionList hobbyId={hobbyId} sessions={sessions} />;
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load sessions: {error.message}</p></div></div>;
    }
    throw error;
  }
}