import { redirect } from "next/navigation";

type ProjectTimelinePageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectTimelinePage({ params, searchParams }: ProjectTimelinePageProps): Promise<never> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;

  const routeQuery = new URLSearchParams();
  if (householdId) {
    routeQuery.set("householdId", householdId);
  }
  routeQuery.set("view", "schedule");

  redirect(`/projects/${projectId}/phases?${routeQuery.toString()}`);
}
