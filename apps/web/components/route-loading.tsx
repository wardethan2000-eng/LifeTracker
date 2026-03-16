"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";

type RouteLoadingProps = {
  children: ReactNode;
  delayMs?: number;
};

export function RouteLoading({ children, delayMs = 140 }: RouteLoadingProps): JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  return <div className={visible ? "route-loading route-loading--visible" : "route-loading"}>{children}</div>;
}