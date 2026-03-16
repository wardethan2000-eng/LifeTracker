import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";
import { getMe } from "../lib/api";
import { SearchCommandPaletteLazy } from "../components/search-command-palette-lazy";
import { SidebarNav } from "../components/sidebar-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AssetKeeper Dashboard",
  description: "Household-first maintenance tracking for vehicles, homes, tools, and equipment."
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>): Promise<JSX.Element> {
  let userName = "User";
  let userRole = "Member";
  let fallbackHouseholdId: string | null = null;

  try {
    const me = await getMe();
    userName = me.user.displayName ?? me.user.email ?? "User";
    userRole = me.households[0] ? "Owner" : "Member";
    fallbackHouseholdId = me.households[0]?.id ?? null;
  } catch {
    // Shell still renders even if user fetch fails
  }

  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <SidebarNav userData={{ userName, initials, userRole }} />
          <div className="main-content">
            <div className="shell-toolbar">
              <SearchCommandPaletteLazy fallbackHouseholdId={fallbackHouseholdId} />
            </div>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}