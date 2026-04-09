"use client";

import type { ReactNode } from "react";
import { Component } from "react";

type AnalyticsPanelBoundaryProps = {
  children: ReactNode;
  title: string;
};

type AnalyticsPanelBoundaryState = {
  hasError: boolean;
};

export class AnalyticsPanelBoundary extends Component<AnalyticsPanelBoundaryProps, AnalyticsPanelBoundaryState> {
  override state: AnalyticsPanelBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(): AnalyticsPanelBoundaryState {
    return { hasError: true };
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="panel">
          <div className="panel__header">
            <h2>{this.props.title}</h2>
          </div>
          <div className="panel__body">
            <p className="panel__empty">This analytics panel could not be loaded right now.</p>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export function AnalyticsPanelSkeleton({ title }: { title: string }): ReactNode {
  return (
    <section className="panel" aria-busy="true" aria-label={`Loading ${title}`}>
      <div className="panel__header">
        <h2>{title}</h2>
      </div>
      <div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>
        <div className="skeleton-bar" style={{ width: "100%", height: 120, borderRadius: 6 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-bar" style={{ height: 64, borderRadius: 6 }} />
          ))}
        </div>
        <div className="skeleton-bar" style={{ width: "70%", height: 14, borderRadius: 4 }} />
        <div className="skeleton-bar" style={{ width: "50%", height: 14, borderRadius: 4 }} />
      </div>
    </section>
  );
}