import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectEntriesPage({ params, searchParams }: Props): Promise<never> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;
  const qs = householdId ? `?householdId=${householdId}` : "";
  redirect(`/projects/${projectId}/notes${qs}`);
}
