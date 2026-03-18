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
    <section className="panel">
      <div className="panel__header">
        <h2>{title}</h2>
      </div>
      <div className="panel__body">
        <p className="panel__empty">Loading analytics panel...</p>
      </div>
    </section>
  );
}