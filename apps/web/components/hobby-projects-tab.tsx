"use client";

import type { HobbyActivityMode, HobbyProjectStatus, HobbyProjectSummary } from "@lifekeeper/types";
import Link from "next/link";
import { useMemo, useState, type JSX } from "react";
import { useFormattedDate } from "../lib/formatted-date";

type HobbyProjectsTabProps = {
  hobbyId: string;
  activityMode: HobbyActivityMode;
  projects: HobbyProjectSummary[];
};

const statusOptions: Array<{ value: HobbyProjectStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

function formatHours(value: number): string {
  return `${value.toFixed(value >= 10 ? 0 : 1)} hr`;
}

function statusClass(status: HobbyProjectStatus): string {
  switch (status) {
    case "planned":
      return "pill pill--muted";
    case "active":
      return "pill pill--info";
    case "paused":
      return "pill pill--warning";
    case "completed":
      return "pill pill--success";
    case "abandoned":
      return "pill pill--danger";
    default:
      return "pill";
  }
}

export function HobbyProjectsTab({ hobbyId, activityMode, projects }: HobbyProjectsTabProps): JSX.Element {
  const { formatDate } = useFormattedDate();
  const [statusFilter, setStatusFilter] = useState<HobbyProjectStatus | "all">("all");

  const visibleProjects = useMemo(() => projects
    .filter((project) => statusFilter === "all" || project.status === statusFilter)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()), [projects, statusFilter]);

  const activeCount = projects.filter((project) => project.status === "active").length;

  return (
    <div className="mode-workspace">
      <section className="panel panel--studio">
        <div className="panel__header mode-workspace__header">
          <div>
            <h2>Projects</h2>
            <p className="mode-workspace__subcopy">
              Track long-running builds, milestone progress, and material consumption.
            </p>
          </div>
          <div className="mode-workspace__header-meta">
            {activityMode === "project" ? <span className="pill pill--info">Primary mode</span> : null}
            <span className="pill">{activeCount} active</span>
          </div>
        </div>
        <div className="section-filter__bar">
          <label className="section-filter__field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as HobbyProjectStatus | "all")}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="panel__body--padded">
          {visibleProjects.length === 0 ? (
            <p className="panel__empty">No hobby projects match the current filter.</p>
          ) : (
            <div className="mode-card-grid">
              {visibleProjects.map((project) => (
                <Link key={project.id} href={`/hobbies/${hobbyId}/projects/${project.id}`} className="mode-card mode-card--project">
                  {project.coverImageUrl ? (
                    <div className="mode-card__media">
                      <img src={project.coverImageUrl} alt="" />
                    </div>
                  ) : null}
                  <div className="mode-card__body">
                    <div className="mode-card__header">
                      <div>
                        <h3>{project.name}</h3>
                        <p>{project.description ?? "No description yet."}</p>
                      </div>
                      <span className={statusClass(project.status)}>{project.status}</span>
                    </div>
                    <div className="mode-progress">
                      <div className="mode-progress__meta">
                        <span>{project.completedMilestoneCount} of {project.milestoneCount} milestones</span>
                        <strong>{Math.round(project.completionPercentage)}%</strong>
                      </div>
                      <div className="mode-progress__bar">
                        <span style={{ width: `${Math.max(0, Math.min(100, project.completionPercentage))}%` }} />
                      </div>
                    </div>
                    <dl className="mode-kv-list">
                      <div><dt>Hours</dt><dd>{formatHours(project.totalLoggedHours)}</dd></div>
                      <div><dt>Dates</dt><dd>{formatDate(project.startDate)} to {formatDate(project.completedDate ?? project.targetEndDate)}</dd></div>
                      <div><dt>Difficulty</dt><dd>{project.difficulty ?? "Not set"}</dd></div>
                    </dl>
                    {project.tags.length > 0 ? (
                      <div className="mode-tag-row">
                        {project.tags.map((tag) => <span key={tag} className="pill pill--muted">{tag}</span>)}
                      </div>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}