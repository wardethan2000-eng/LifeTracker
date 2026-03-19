import type { JSX } from "react";
import Link from "next/link";
import { HobbyDangerActions } from "../../../../../components/hobby-danger-actions";
import {
  ApiError,
  getHobbyDetail,
  getMe,
} from "../../../../../lib/api";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

function formatDate(iso: string | null | undefined, fallback = "-"): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active": return "pill pill--success";
    case "paused": return "pill pill--warning";
    case "archived": return "pill pill--muted";
    default: return "pill";
  }
}

export default async function HobbySettingsPage({ params }: HobbySectionPageProps): Promise<JSX.Element> {
  const { hobbyId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];
    if (!household) return <p>No household found.</p>;

    const hobby = await getHobbyDetail(household.id, hobbyId);
    const isPipeline = hobby.lifecycleMode === "pipeline";
    const pipelineSteps = hobby.statusPipeline.sort((a, b) => a.sortOrder - b.sortOrder);

    return (
      <div style={{ display: "grid", gap: "24px" }}>
        <section className="panel">
          <div className="panel__header">
            <h2>Hobby Details</h2>
            <Link href={`/hobbies/${hobbyId}/edit`} className="button button--secondary button--sm">
              Edit Hobby
            </Link>
          </div>
          <div className="panel__body--padded">
            <dl className="data-list">
              <div><dt>Name</dt><dd>{hobby.name}</dd></div>
              <div><dt>Description</dt><dd>{hobby.description ?? "Not set"}</dd></div>
              <div><dt>Status</dt><dd><span className={statusBadgeClass(hobby.status)}>{hobby.status}</span></dd></div>
              {hobby.hobbyType ? <div><dt>Hobby Type</dt><dd>{hobby.hobbyType}</dd></div> : null}
              <div><dt>Workflow</dt><dd>{isPipeline ? "Pipeline workflow" : "Simple status"}</dd></div>
              <div><dt>Notes</dt><dd>{hobby.notes ?? "Not set"}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(hobby.createdAt)}</dd></div>
              <div><dt>Updated</dt><dd>{formatDate(hobby.updatedAt)}</dd></div>
            </dl>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "16px" }}>
              {isPipeline
                ? "Pipeline workflow gives each session named stages instead of a single active/completed status. New sessions start on the first step, advance in order, and the final step marks completion."
                : "Simple status keeps sessions on the standard active/completed flow without named workflow stages."}
            </p>
          </div>
        </section>

        {isPipeline ? (
          <section className="panel">
            <div className="panel__header">
              <div>
                <h2>Pipeline Steps</h2>
                <p className="workbench-section__hint" style={{ marginTop: "4px" }}>
                  These stages define how sessions move from start to finish.
                </p>
              </div>
              <Link href={`/hobbies/${hobbyId}/edit#pipeline-workflow`} className="button button--secondary button--sm">
                Edit Workflow
              </Link>
            </div>
            <div className="panel__body--padded">
              {pipelineSteps.length === 0 ? (
                <p className="panel__empty">No pipeline steps defined. Add workflow stages in Edit Hobby so sessions can show progress.</p>
              ) : (
                <>
                  <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "12px" }}>
                    New sessions start on <strong>{pipelineSteps[0]?.label}</strong>. The advance action moves a session to the next step, and <strong>{pipelineSteps.find((step) => step.isFinal)?.label ?? "the final step"}</strong> closes it out.
                  </p>
                  <ol style={{ paddingLeft: "20px", display: "grid", gap: "8px" }}>
                    {pipelineSteps.map((step) => (
                      <li key={step.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {step.color ? (
                          <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: step.color, flexShrink: 0 }} />
                        ) : null}
                        <span>{step.label}</span>
                        {step.isFinal ? <span className="pill pill--muted" style={{ fontSize: "0.7rem" }}>Final</span> : null}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel__header"><h2>Inventory Categories</h2></div>
          <div className="panel__body--padded">
            {hobby.inventoryCategories.length === 0 ? (
              <p className="panel__empty">No inventory categories defined.</p>
            ) : (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {hobby.inventoryCategories.map((cat) => (
                  <span key={cat.id} className="pill">{cat.categoryName}</span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Linked Assets</h2></div>
          <div className="panel__body--padded">
            {hobby.assetLinks.length === 0 ? (
              <p className="panel__empty">No assets linked.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {hobby.assetLinks.map((link) => (
                  <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Link href={`/assets/${link.assetId}`} className="text-link">{link.asset.name}</Link>
                    {link.role ? <span className="pill">{link.role}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel__header"><h2>Linked Projects</h2></div>
          <div className="panel__body--padded">
            {hobby.projectLinks.length === 0 ? (
              <p className="panel__empty">No projects linked.</p>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {hobby.projectLinks.map((link) => (
                  <div key={link.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Link href={`/projects/${link.projectId}`} className="text-link">{link.project.name}</Link>
                    <span className={statusBadgeClass(link.project.status)}>{link.project.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel" style={{ borderColor: "var(--danger)" }}>
          <div className="panel__header"><h2>Archive or Delete</h2></div>
          <div className="panel__body--padded">
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "12px" }}>
              Archive hides the hobby from active work without removing its history. Delete removes the hobby and its related records.
            </p>
            <HobbyDangerActions
              householdId={household.id}
              hobbyId={hobbyId}
              isArchived={hobby.status === "archived"}
            />
          </div>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return <div className="panel"><div className="panel__body--padded"><p>Failed to load settings: {error.message}</p></div></div>;
    }
    throw error;
  }
}