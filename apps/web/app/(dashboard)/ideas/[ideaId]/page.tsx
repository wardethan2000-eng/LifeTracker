import Link from "next/link";
import type { JSX } from "react";
import { Suspense } from "react";
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

// ── Deferred overview content ──────────────────────────────
async function IdeaOverviewContent({ householdId, ideaId, timezone }: { householdId: string; ideaId: string; timezone: string }): Promise<JSX.Element> {
  try {
    const [idea, entriesResult, canvases, pinnedResult, overviewPins] = await Promise.all([
      getIdea(householdId, ideaId),
      getEntries(householdId, {
        entityType: "idea",
        entityId: ideaId,
        limit: 1,
        sortBy: "entryDate",
        excludeFlags: ["archived"],
      }).catch(() => ({ items: [], nextCursor: null })),
      getCanvasesByEntity(householdId, "idea", ideaId).catch(() => []),
      getEntries(householdId, { entityType: "idea", entityId: ideaId, flags: ["pinned"], limit: 10 }).catch(() => ({ items: [], nextCursor: null })),
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

    const createdDate = formatDate(idea.createdAt, "-", timezone);

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <span className={`priority-dot priority-dot--${idea.priority}`} />
          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
            {priorityLabels[idea.priority]} priority
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>
            · Created {createdDate}
          </span>
        </div>

        <PinnedOverviewSection
          householdId={householdId}
          entityType="idea"
          entityId={ideaId}
          entries={pinnedResult.items}
          overviewPins={overviewPins}
        />
        <div className="resource-layout">
          <div className="resource-layout__primary">
            <IdeaDescriptionCard
              householdId={householdId}
              ideaId={idea.id}
              description={idea.description}
            />
            <NotesAndCanvasCard
              householdId={householdId}
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
              householdId={householdId}
              ideaId={idea.id}
              links={idea.links}
            />
          </div>
          <div className="resource-layout__aside">
            <IdeaStatusCard
              householdId={householdId}
              ideaId={idea.id}
              stage={idea.stage}
              priority={idea.priority}
              category={idea.category}
              createdAt={idea.createdAt}
              updatedAt={idea.updatedAt}
            />
            <IdeaPromotionCard
              householdId={householdId}
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

        <IdeaMaterialsCard
          householdId={householdId}
          ideaId={idea.id}
          materials={idea.materials}
        />
        <IdeaStepsCard
          householdId={householdId}
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

// ── Page ──────────────────────────────────────────────────
export default async function IdeaOverviewPage({ params }: IdeaDetailPageProps): Promise<JSX.Element> {
  const { ideaId } = await params;

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <p>No household found. <Link href="/ideas" className="text-link">← Ideas</Link>.</p>;
  }

  return (
    <Suspense fallback={<section className="panel" aria-hidden="true"><div className="panel__body--padded" style={{ display: "grid", gap: 12 }}>{[1, 2, 3].map((i) => (<div key={i} className="skeleton-bar" style={{ width: "100%", height: 52, borderRadius: 8 }} />))}</div></section>}>
      <IdeaOverviewContent householdId={household.id} ideaId={ideaId} timezone={household.timezone} />
    </Suspense>
  );
}
