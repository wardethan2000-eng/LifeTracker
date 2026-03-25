import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDisplayPreferences, getHouseholdDashboard, getMe } from "../../lib/api";
import { SearchCommandPaletteLazy } from "../../components/search-command-palette-lazy";
import { RoutePrefetcher } from "../../components/route-prefetcher";
import { RealtimeStatusIndicator } from "../../components/realtime-status-indicator";
import { SidebarNav, type SidebarNavGroup } from "../../components/sidebar-nav";
import { TimezoneProvider } from "../../lib/timezone-context";
import { DisplayPreferencesProvider } from "../../components/display-preferences-context";

type NavItemDef = {
  href: string;
  label: string;
  translationKey: string;
  icon: string;
};

function buildNavGroups(
  t: (key: string) => string,
  badges: { maintenance: number; notifications: number },
): SidebarNavGroup[] {
  const item = (def: NavItemDef, badge?: number) => ({
    href: def.href,
    label: t(`nav.${def.translationKey}`),
    icon: def.icon,
    ...(badge && badge > 0 ? { badge } : {}),
  });

  const dashboard: NavItemDef = { href: "/", label: "Dashboard", translationKey: "dashboard", icon: "grid" };
  const capture: NavItemDef[] = [
    { href: "/ideas", label: "Ideas", translationKey: "ideas", icon: "lightbulb" },
    { href: "/notes", label: "Notes", translationKey: "notes", icon: "file-text" },
  ];
  const manage: NavItemDef[] = [
    { href: "/assets", label: "Assets", translationKey: "assets", icon: "box" },
    { href: "/inventory", label: "Inventory", translationKey: "inventory", icon: "layers" },
    { href: "/projects", label: "Projects", translationKey: "projects", icon: "folder" },
    { href: "/hobbies", label: "Hobbies", translationKey: "hobbies", icon: "beaker" },
    { href: "/maintenance", label: "Maintenance", translationKey: "maintenance", icon: "wrench" },
  ];
  const insights: NavItemDef[] = [
    { href: "/analytics", label: "Analytics", translationKey: "analytics", icon: "dollar" },
    { href: "/service-providers", label: "Providers", translationKey: "providers", icon: "briefcase" },
    { href: "/activity", label: "Activity", translationKey: "activity", icon: "pulse" },
  ];
  const tools: NavItemDef[] = [
    { href: "/trash", label: "Trash", translationKey: "trash", icon: "trash" },
  ];

  return [
    { label: null, items: [item(dashboard)] },
    { label: t("nav.groupCapture"), items: capture.map((d) => item(d)) },
    { label: t("nav.groupManage"), items: manage.map((d) => item(d, d.href === "/maintenance" ? badges.maintenance : undefined)) },
    { label: t("nav.groupInsights"), items: insights.map((d) => item(d)) },
    { label: null, items: tools.map((d) => item(d)) },
  ];
}

const prefetchedRoutes = [
  "/ideas",
  "/notes",
  "/assets",
  "/inventory",
  "/projects",
  "/hobbies",
  "/maintenance",
  "/analytics",
];

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>): Promise<JSX.Element> {
  const t = await getTranslations("common");
  let userName = "User";
  let userRole = "Member";
  let fallbackHouseholdId: string | null = null;
  let householdTimezone = "America/New_York";
  let maintenanceBadge = 0;

  const [displayPreferences] = await Promise.allSettled([getDisplayPreferences()]);
  const resolvedDisplayPreferences = displayPreferences.status === "fulfilled" ? displayPreferences.value : { pageSize: 25, dateFormat: "US" as const, currencyCode: "USD" };

  try {
    const me = await getMe();
    userName = me.user.displayName ?? me.user.email ?? "User";
    userRole = me.households[0] ? "Owner" : "Member";
    fallbackHouseholdId = me.households[0]?.id ?? null;
    householdTimezone = me.households[0]?.timezone ?? "America/New_York";

    if (fallbackHouseholdId) {
      try {
        const dashboard = await getHouseholdDashboard(fallbackHouseholdId);
        maintenanceBadge = dashboard.stats.overdueScheduleCount + dashboard.stats.dueScheduleCount;
      } catch {
        // Badge counts are best-effort
      }
    }
  } catch {
    // Shell still renders even if user fetch fails.
  }

  const navGroups = buildNavGroups(t, {
    maintenance: maintenanceBadge,
    notifications: 0,
  });

  const initials = userName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <h1>{t("brand.name")}</h1>
          <p>{t("brand.tagline")}</p>
        </div>

        <SidebarNav groups={navGroups} householdId={fallbackHouseholdId} />

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{initials || "U"}</div>
            <div className="sidebar__user-info">
              <strong>{userName}</strong>
              <span>{userRole}</span>
            </div>
          </div>
          <div className="sidebar__footer-actions">
            <Link href="/settings" className="sidebar__settings-link">
              User Settings
            </Link>
          </div>
        </div>
      </nav>

      <div className="main-content">
        <RoutePrefetcher routes={prefetchedRoutes} />
        <div className="shell-toolbar">
          <SearchCommandPaletteLazy fallbackHouseholdId={fallbackHouseholdId} />
          <div className="shell-toolbar__controls">
            <RealtimeStatusIndicator householdId={fallbackHouseholdId} />
          </div>
        </div>
        <TimezoneProvider timezone={householdTimezone}>
            <DisplayPreferencesProvider initialPreferences={resolvedDisplayPreferences}>
              {children}
            </DisplayPreferencesProvider>
          </TimezoneProvider>
      </div>
    </div>
  );
}