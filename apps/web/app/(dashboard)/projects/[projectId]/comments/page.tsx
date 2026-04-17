import { redirect } from "next/navigation";

type ProjectCommentsPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectCommentsPage({ params, searchParams }: ProjectCommentsPageProps): Promise<never> {
  const { projectId } = await params;
  const query = searchParams ? await searchParams : {};
  const householdId = typeof query.householdId === "string" ? query.householdId : undefined;
  const nextQuery = new URLSearchParams(householdId ? { householdId } : {});

  redirect(`/projects/${projectId}/notepad?${nextQuery.toString()}`);
}
