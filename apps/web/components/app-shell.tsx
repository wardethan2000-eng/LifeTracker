import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getMe } from "../lib/api";

type AppShellProps = {
  children: React.ReactNode;
  activePath: string;
};

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" },
  { href: "/assets", label: "Assets", icon: "box" },
  { href: "/assets/new", label: "Add Asset", icon: "plus" },
  { href: "/maintenance", label: "Maintenance", icon: "wrench" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

const NavIcon = ({ icon }: { icon: string }): JSX.Element => {
  switch (icon) {
    case "grid":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case "box":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
    case "plus":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "wrench":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
    case "bell":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    default:
      return <></>;
  }
};

export async function AppShell({ children, activePath }: AppShellProps): Promise<JSX.Element> {
  let userName = "User";
  let userRole = "Member";

  try {
    const me = await getMe();
    userName = me.user.displayName ?? me.user.email ?? "User";
    userRole = me.households[0] ? "Owner" : "Member";
  } catch {
    // Sidebar still renders even if user fetch fails
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

        <div className="sidebar__nav">
          <div className="sidebar__section-label">Main</div>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar__link${activePath === item.href ? " sidebar__link--active" : ""}`}
            >
              <NavIcon icon={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>

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
        {children}
      </div>
    </div>
  );
}
