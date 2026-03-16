"use client";

import dynamic from "next/dynamic";

type SearchCommandPaletteLazyProps = {
  fallbackHouseholdId: string | null;
};

const SearchCommandPalette = dynamic(
  () => import("./search-command-palette").then((mod) => ({ default: mod.SearchCommandPalette })),
  { ssr: false }
);

export function SearchCommandPaletteLazy({ fallbackHouseholdId }: SearchCommandPaletteLazyProps) {
  return <SearchCommandPalette fallbackHouseholdId={fallbackHouseholdId} />;
}