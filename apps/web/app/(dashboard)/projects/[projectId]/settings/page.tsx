import type { JSX } from "react";
import ProjectDetailPage from "../page";

type ProjectSectionPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectSettingsPage({ params, searchParams }: ProjectSectionPageProps): Promise<JSX.Element> {
  const routeParams = await params;
  const query = searchParams ? await searchParams : {};

  return ProjectDetailPage({
    params: Promise.resolve(routeParams),
    searchParams: Promise.resolve({ ...query, tab: "settings" }),
  });
}