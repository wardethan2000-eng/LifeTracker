import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getIdea, getMe } from "../../../../lib/api";
import { IdeaDescriptionCard } from "../../../../components/idea-description-card";
import { IdeaNotesLog } from "../../../../components/idea-notes-log";
import { IdeaLinksCard } from "../../../../components/idea-links-card";
import { IdeaStatusCard } from "../../../../components/idea-status-card";
import { IdeaPromotionCard } from "../../../../components/idea-promotion-card";
import { IdeaProvenanceCard } from "../../../../components/idea-provenance-card";
import { IdeaMaterialsCard } from "../../../../components/idea-materials-card";
import { IdeaStepsCard } from "../../../../components/idea-steps-card";

const stageLabels: Record<string, string> = {
  spark: "Spark",
  developing: "Developing",
  ready: "Ready",
};

const stageChipVariant: Record<string, string> = {
  spark: "clear",
  developing: "upcoming",
  ready: "success",
};

const categoryLabels: Record<string, string> = {
  home_improvement: "Home Improvement",
  vehicle: "Vehicle",
  outdoor: "Outdoor",
  technology: "Technology",
  hobby_craft: "Hobby / Craft",
  financial: "Financial",
  health: "Health",
  travel: "Travel",
  learning: "Learning",
  other: "Other",
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type IdeaDetailPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaDetailPage({ params }: IdeaDetailPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return <p>No household found. <Link href="/ideas" className="text-link">Go back to Ideas</Link>.</p>;
    }

    const idea = await getIdea(household.id, ideaId);

    const createdDate = new Date(idea.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return (
      <>
        {/* Top bar */}
        <div className="detail-topbar">
          <Link href="/ideas" className="text-link">← Back to Ideas</Link>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!idea.archivedAt && (
              <Link href={`/ideas/${idea.id}/edit`} className="button button--ghost button--sm">
                Edit
              </Link>
            )}
          </div>
        </div>

        {/* Page header */}
        <div className="detail-body">
          <section className="detail-hero">
            <div className="detail-hero__info">
              {idea.category && (
                <span style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-muted)" }}>
                  {categoryLabels[idea.category] ?? idea.category}
                </span>
              )}
              <h1>{idea.title}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className={`status-chip status-chip--${stageChipVariant[idea.stage] ?? "clear"}`}>
                  {stageLabels[idea.stage] ?? idea.stage}
                </span>
                <span className={`priority-dot priority-dot--${idea.priority}`} />
                <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                  {priorityLabels[idea.priority]}
                </span>
                <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
                  · Created {createdDate}
                </span>
                {idea.archivedAt && (
                  <span className="status-chip status-chip--danger">Archived</span>
                )}
              </div>
            </div>
          </section>

          {/* Two-column layout */}
          <div className="resource-layout">
            <div className="resource-layout__primary">
              <IdeaDescriptionCard
                householdId={household.id}
                ideaId={idea.id}
                description={idea.description}
              />
              <IdeaNotesLog
                householdId={household.id}
                ideaId={idea.id}
                notes={idea.notes}
              />
              <IdeaLinksCard
                householdId={household.id}
                ideaId={idea.id}
                links={idea.links}
              />
            </div>
            <div className="resource-layout__aside">
              <IdeaStatusCard
                householdId={household.id}
                ideaId={idea.id}
                stage={idea.stage}
                priority={idea.priority}
                category={idea.category}
                createdAt={idea.createdAt}
                updatedAt={idea.updatedAt}
              />
              <IdeaPromotionCard
                householdId={household.id}
                ideaId={idea.id}
                title={idea.title}
                description={idea.description}
                stepCount={idea.steps.length}
                promotionTarget={idea.promotionTarget}
                promotedAt={idea.promotedAt}
                promotedToType={idea.promotedToType}
                promotedToId={idea.promotedToId}
                demotedFromType={idea.demotedFromType}
                demotedFromId={idea.demotedFromId}
              />
              <IdeaProvenanceCard
                demotedFromType={idea.demotedFromType}
                demotedFromId={idea.demotedFromId}
                promotedAt={idea.promotedAt}
                promotedToType={idea.promotedToType}
                promotedToId={idea.promotedToId}
                createdAt={idea.createdAt}
              />
            </div>
          </div>

          {/* Full-width cards below grid */}
          <IdeaMaterialsCard
            householdId={household.id}
            ideaId={idea.id}
            materials={idea.materials}
          />
          <IdeaStepsCard
            householdId={household.id}
            ideaId={idea.id}
            steps={idea.steps}
          />
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load idea: {error.message}</p>
            <Link href="/ideas" className="text-link">← Back to Ideas</Link>
          </div>
        </div>
      );
    }
    throw error;
  }
}
