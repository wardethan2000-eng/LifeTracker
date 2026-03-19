import type { JSX } from "react";
import NewProjectPage from "../page";

type NewProjectTemplatePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewProjectTemplatePage({ searchParams }: NewProjectTemplatePageProps): Promise<JSX.Element> {
  const query = searchParams ? await searchParams : {};

  return NewProjectPage({
    searchParams: Promise.resolve({ ...query, mode: "template" }),
  });
}