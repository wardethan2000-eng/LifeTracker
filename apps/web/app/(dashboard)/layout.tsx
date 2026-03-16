import type { JSX, ReactNode } from "react";
import { getMe } from "../../lib/api";
import { SearchCommandPaletteLazy } from "../../components/search-command-palette-lazy";
import { RoutePrefetcher } from "../../components/route-prefetcher";
import { SidebarNav, type SidebarNavItem } from "../../components/sidebar-nav";

const navItems: SidebarNavItem[] = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/assets", label: "Assets", icon: "box" },
  { href: "/inventory", label: "Inventory", icon: "layers" },
  { href: "/assets/new", label: "Add Asset", icon: "plus" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/analytics", label: "Analytics", icon: "dollar" },
  { href: "/hobbies", label: "Hobbies", icon: "beaker" },
  { href: "/maintenance", label: "Maintenance", icon: "wrench" },
  { href: "/activity", label: "Activity", icon: "pulse" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/invitations", label: "Invitations", icon: "mail" },
  { href: "/service-providers", label: "Providers", icon: "briefcase" },
];

const prefetchedRoutes = [
  "/assets",
  "/projects",
  "/hobbies",
  "/maintenance",
  "/inventory",
  "/notifications",
  "/activity"
];

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>): Promise<JSX.Element> {
  let userName = "User";
  let userRole = "Member";
  let fallbackHouseholdId: string | null = null;

  try {
    const me = await getMe();
    userName = me.user.displayName ?? me.user.email ?? "User";
    userRole = me.households[0] ? "Owner" : "Member";
    fallbackHouseholdId = me.households[0]?.id ?? null;
  } catch {
    // Shell still renders even if user fetch fails.
  }

  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <h1>AssetKeeper</h1>
          <p>Maintenance Tracker</p>
        </div>

        <SidebarNav navItems={navItems} />

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{initials || "U"}</div>
            <div className="sidebar__user-info">
              <strong>{userName}</strong>
              <span>{userRole}</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="main-content">
        <RoutePrefetcher routes={prefetchedRoutes} />
        <div className="shell-toolbar">
          <SearchCommandPaletteLazy fallbackHouseholdId={fallbackHouseholdId} />
        </div>
        {children}
      </div>
    </div>
  );
}