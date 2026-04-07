"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IdeaQuickCapture } from "./idea-quick-capture";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

export type SidebarNavGroup = {
  label: string | null;
  items: SidebarNavItem[];
};

type SidebarNavProps = {
  groups: SidebarNavGroup[];
  householdId?: string | null;
};

const NavIcon = ({ icon }: { icon: string }): JSX.Element => {
  switch (icon) {
    case "grid":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case "box":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
    case "layers":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
    case "folder":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
    case "bar-chart":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
    case "beaker":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>;
    case "briefcase":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case "pulse":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
    case "mail":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/></svg>;
    case "plus":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "wrench":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
    case "bell":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case "lightbulb":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>;
    case "file-text":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    case "trash":
      return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
    default:
      return <></>;
  }
};

export function SidebarNav({ groups, householdId }: SidebarNavProps): JSX.Element {
  const pathname = usePathname();
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const quickAddRef = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [liveBadges, setLiveBadges] = useState<Record<string, number>>({});

  // Restore collapse state from localStorage and sync to <html> data attribute
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    const isCollapsed = stored === "true";
    setCollapsed(isCollapsed);
    document.documentElement.dataset.sidebarCollapsed = String(isCollapsed);

    const storedGroups = localStorage.getItem("sidebar-collapsed-groups");
    if (storedGroups) {
      try {
        setCollapsedGroups(new Set(JSON.parse(storedGroups) as string[]));
      } catch {
        // ignore malformed storage
      }
    }
  }, []);

  // Load the maintenance badge count asynchronously so it doesn't block server render.
  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetch(`/api/households/${householdId}/dashboard`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { stats?: { overdueScheduleCount?: number; dueScheduleCount?: number } }) => {
        if (cancelled) return;
        const count = (data.stats?.overdueScheduleCount ?? 0) + (data.stats?.dueScheduleCount ?? 0);
        if (count > 0) setLiveBadges((prev) => ({ ...prev, maintenance: count }));
      })
      .catch(() => { /* badge is best-effort */ });
    return () => { cancelled = true; };
  }, [householdId]);

  // Load the notifications unread count asynchronously.
  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;
    fetch(`/api/households/${householdId}/notifications?limit=1&status=unread`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { unreadCount?: number }) => {
        if (cancelled) return;
        const count = data.unreadCount ?? 0;
        if (count > 0) setLiveBadges((prev) => ({ ...prev, notifications: Math.min(count, 99) }));
      })
      .catch(() => { /* badge is best-effort */ });
    return () => { cancelled = true; };
  }, [householdId]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      document.documentElement.dataset.sidebarCollapsed = String(next);
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const toggleGroupCollapse = useCallback((groupLabel: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupLabel)) {
        next.delete(groupLabel);
      } else {
        next.add(groupLabel);
      }
      localStorage.setItem("sidebar-collapsed-groups", JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const handleCloseCapture = useCallback(() => {
    setShowQuickCapture(false);
  }, []);

  return (
    <div className="sidebar__nav">
      {/* Collapse / expand toggle */}
      <button
        type="button"
        className="sidebar__collapse-btn"
        onClick={toggleCollapse}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
        )}
        <span className="sidebar__collapse-label">Collapse</span>
      </button>
      {groups.map((group, groupIndex) => {
        const isGroupCollapsed = group.label ? collapsedGroups.has(group.label) : false;
        return (
        <div key={group.label ?? groupIndex} className={`sidebar__group${isGroupCollapsed ? " sidebar__group--collapsed" : ""}`}>
          {group.label ? (
            <div className="sidebar__section-label">
              <span>{group.label}</span>
              {!collapsed && (
                <button
                  type="button"
                  className="sidebar__group-toggle"
                  onClick={() => toggleGroupCollapse(group.label!)}
                  aria-label={isGroupCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                  aria-expanded={!isGroupCollapsed}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: isGroupCollapsed ? "rotate(-90deg)" : "none", transition: "transform 180ms ease" }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              )}
            </div>
          ) : null}
          {!isGroupCollapsed && group.items.map((item) => {
        const isAssetsCreatePath = pathname === "/assets/new" || pathname.startsWith("/assets/new/");
        const isActive = item.href === "/"
          ? pathname === "/"
          : item.href === "/assets"
            ? !isAssetsCreatePath && (pathname === item.href || pathname.startsWith(`${item.href}/`))
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        const isIdeas = item.href === "/ideas";
        const effectiveBadge = item.href === "/maintenance"
          ? (liveBadges.maintenance ?? item.badge ?? 0)
          : item.href === "/notifications"
            ? (liveBadges.notifications ?? item.badge ?? 0)
            : (item.badge ?? 0);

        if (isIdeas && householdId) {
          return (
            <div key={item.href} className="sidebar__link-row">
              <Link
                href={item.href}
                prefetch={true}
                className={`sidebar__link${isActive ? " sidebar__link--active" : ""}`}
              >
                <NavIcon icon={item.icon} />
                <span className="sidebar__link-label">{item.label}</span>
                {effectiveBadge > 0 ? <span className="sidebar__badge">{effectiveBadge}</span> : null}
              </Link>
              <button
                ref={quickAddRef}
                type="button"
                className="sidebar__quick-add"
                onClick={() => setShowQuickCapture(true)}
                title="Quick capture idea"
                aria-label="Quick capture idea"
              >
                +
              </button>
              {showQuickCapture && (
                <IdeaQuickCapture
                  householdId={householdId}
                  triggerRef={quickAddRef}
                  onClose={handleCloseCapture}
                />
              )}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={`sidebar__link${isActive ? " sidebar__link--active" : ""}`}
          >
            <NavIcon icon={item.icon} />
            <span className="sidebar__link-label">{item.label}</span>
            {effectiveBadge > 0 ? <span className="sidebar__badge">{effectiveBadge}</span> : null}
          </Link>
        );
      })}
        </div>
        );
      })}
    </div>
  );
}
