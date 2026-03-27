import Link from "next/link";
import type { JSX } from "react";
import { ApiError, getCanvasesByEntity, getEntries, getIdea, getMe, getOverviewPins } from "../../../../lib/api";
import { formatDate } from "../../../../lib/formatters";
import { IdeaDescriptionCard } from "../../../../components/idea-description-card";
import { IdeaLinksCard } from "../../../../components/idea-links-card";
import { IdeaStatusCard } from "../../../../components/idea-status-card";
import { IdeaPromotionCard } from "../../../../components/idea-promotion-card";
import { IdeaProvenanceCard } from "../../../../components/idea-provenance-card";
import { IdeaMaterialsCard } from "../../../../components/idea-materials-card";
import { IdeaStepsCard } from "../../../../components/idea-steps-card";
import { NotesAndCanvasCard } from "../../../../components/notes-canvas-card";
import { PinnedOverviewSection } from "../../../../components/pinned-overview-section";

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

type IdeaDetailPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaOverviewPage({ params }: IdeaDetailPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  try {
    const me = await getMe();
    const household = me.households[0];

    if (!household) {
      return <p>No household found. <Link href="/ideas" className="text-link">← Ideas</Link>.</p>;
    }

    const [idea, entriesResult, canvases, pinnedResult, overviewPins] = await Promise.all([
      getIdea(household.id, ideaId),
      getEntries(household.id, {
        entityType: "idea",
        entityId: ideaId,
        limit: 1,
        sortBy: "entryDate",
        excludeFlags: ["archived"],
      }).catch(() => ({ items: [], nextCursor: null })),
      getCanvasesByEntity(household.id, "idea", ideaId).catch(() => []),
      getEntries(household.id, { entityType: "idea", entityId: ideaId, flags: ["pinned"], limit: 10 }).catch(() => ({ items: [], nextCursor: null })),
      getOverviewPins("idea", ideaId).catch(() => []),
    ]);

    const rawNote = entriesResult.items[0] ?? null;
    const recentNote = rawNote
      ? { id: rawNote.id, title: rawNote.title ?? null, body: rawNote.body, bodyFormat: rawNote.bodyFormat, entryDate: rawNote.entryDate }
      : null;
    const canvasSummaries = canvases.map((c) => ({
      id: c.id,
      name: c.name,
      canvasMode: c.canvasMode,
      nodeCount: c.nodeCount,
      edgeCount: c.edgeCount,
      updatedAt: c.updatedAt,
    }));

    const createdDate = formatDate(idea.createdAt, "-", household.timezone);

    return (
      <>
        {/* Summary meta line */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <span className={`priority-dot priority-dot--${idea.priority}`} />
          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
            {priorityLabels[idea.priority]} priority
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
            · Created {createdDate}
          </span>
        </div>

        {/* Two-column layout */}
        <PinnedOverviewSection
          householdId={household.id}
          entityType="idea"
          entityId={ideaId}
          entries={pinnedResult.items}
          overviewPins={overviewPins}
        />
        <div className="resource-layout">
          <div className="resource-layout__primary">
            <IdeaDescriptionCard
              householdId={household.id}
              ideaId={idea.id}
              description={idea.description}
            />
            <NotesAndCanvasCard
              householdId={household.id}
              entityType="idea"
              entityId={idea.id}
              recentNote={recentNote}
              canvases={canvasSummaries}
              allNotesHref={`/notes?entityType=idea&entityId=${idea.id}`}
              legacyIdeaNotes={idea.notes.map((note) => ({
                id: note.id,
                text: note.text,
                createdAt: note.createdAt,
              }))}
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
      </>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <div className="panel">
          <div className="panel__body--padded">
            <p>Failed to load idea: {error.message}</p>
            <Link href="/ideas" className="text-link">← Ideas</Link>
          </div>
        </div>
      );
    }
    throw error;
  }
}
