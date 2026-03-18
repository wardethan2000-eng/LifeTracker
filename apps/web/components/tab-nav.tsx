"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type TabNavItem = {
  id: string;
  label: ReactNode;
  active: boolean;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type TabNavProps = {
  items: TabNavItem[];
  ariaLabel: string;
  variant?: "underline" | "pill" | "analytics";
};

export function TabNav({ items, ariaLabel, variant = "underline" }: TabNavProps): JSX.Element {
  return (
    <nav className={`tab-nav tab-nav--${variant}`} aria-label={ariaLabel}>
      <ul className="tab-nav__list">
        {items.map((item) => {
          const itemClassName = `tab-nav__item${item.active ? " tab-nav__item--active" : ""}`;

          return (
            <li key={item.id} className={itemClassName}>
              {item.href ? (
                <Link href={item.href} className="tab-nav__control" aria-current={item.active ? "page" : undefined}>
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  className="tab-nav__control"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}