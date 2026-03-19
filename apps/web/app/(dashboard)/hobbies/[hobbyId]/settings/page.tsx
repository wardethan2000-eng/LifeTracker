import type { JSX } from "react";
import HobbyDetailPage from "../page";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbySettingsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const routeParams = await params;

  return HobbyDetailPage({
    params: Promise.resolve(routeParams),
    searchParams: Promise.resolve({ tab: "settings" }),
  });
}