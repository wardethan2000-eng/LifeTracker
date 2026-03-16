import { redirect } from "next/navigation";
import type { JSX } from "react";

type CostsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const getParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
};

export default async function CostsPage({ searchParams }: CostsPageProps): Promise<JSX.Element> {
  const params = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  const householdId = getParam(params.householdId);

  query.set("tab", "costs");

  if (householdId) {
    query.set("householdId", householdId);
  }

  redirect(`/analytics?${query.toString()}`);
}