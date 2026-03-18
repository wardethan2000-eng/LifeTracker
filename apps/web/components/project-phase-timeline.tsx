"use client";

import type {
  HouseholdMember,
  InventoryItemSummary,
  ProjectBudgetCategorySummary,
  ProjectPhaseDetail,
  ProjectPhaseSummary,
  ServiceProvider
} from "@lifekeeper/types";
import type { JSX, ReactNode } from "react";
import { CompactPhasePreview } from "./compact-phase-preview";
import { ExpandableCard } from "./expandable-card";
import { ProjectPhaseCard } from "./project-phase-card";
import { ProjectPhaseDetail as ProjectPhaseDetailPanel } from "./project-phase-detail";
import {
  SectionFilterBar,
  SectionFilterChildren,
  SectionFilterProvider,
  SectionFilterToggle
} from "./section-filter";

type ProjectPhaseTimelineProps = {
  householdId: string;
  projectId: string;
  focusedPhaseId?: string | undefined;
  phases: ProjectPhaseSummary[];
  phaseDetails: ProjectPhaseDetail[];
  allTasks: ProjectPhaseDetail["tasks"];
  householdMembers: HouseholdMember[];
  serviceProviders: ServiceProvider[];
  budgetCategories: ProjectBudgetCategorySummary[];
  inventoryItems: InventoryItemSummary[];
  addPhaseForm: ReactNode;
};

export function ProjectPhaseTimeline({
  householdId,
  projectId,
  focusedPhaseId,
  phases,
  phaseDetails,
  allTasks,
  householdMembers,
  serviceProviders,
  budgetCategories,
  inventoryItems,
  addPhaseForm
}: ProjectPhaseTimelineProps): JSX.Element {
  const phaseDetailsById = new Map(phaseDetails.map((phase) => [phase.id, phase]));

  return (
    <SectionFilterProvider items={phases} keys={["name", "description"]} placeholder="Filter phases by name or description">
      <ExpandableCard
        title="Phase Timeline"
        modalTitle="Phase Timeline"
        previewContent={<CompactPhasePreview phases={phases} />}
        actions={<SectionFilterToggle />}
        headerContent={<SectionFilterBar />}
      >
        <SectionFilterChildren<ProjectPhaseSummary>>
          {(filteredPhases) => (
            <div>
              <div className="project-phase-stack" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {filteredPhases.map((phase) => {
                  const phaseDetail = phaseDetailsById.get(phase.id);

                  if (!phaseDetail) {
                    return null;
                  }

                  return (
                    <details
                      key={phase.id}
                      id={`phase-${phase.id}`}
                      className="project-phase-details"
                      open={focusedPhaseId === phase.id}
                      style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
                    >
                      <summary style={{ listStyle: "none", cursor: "pointer", padding: 0 }}>
                        <ProjectPhaseCard phase={phase} />
                      </summary>
                      <div className="project-phase-details__content" style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                        <ProjectPhaseDetailPanel
                          householdId={householdId}
                          projectId={projectId}
                          phase={phaseDetail}
                          allTasks={allTasks}
                          householdMembers={householdMembers}
                          serviceProviders={serviceProviders}
                          budgetCategories={budgetCategories}
                          inventoryItems={inventoryItems}
                        />
                      </div>
                    </details>
                  );
                })}
              </div>
              {phases.length === 0 ? <p className="panel__empty">No phases defined yet. Add one below to sequence the work.</p> : null}
              {phases.length > 0 && filteredPhases.length === 0 ? <p className="panel__empty">No phases match that search.</p> : null}
              <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                {addPhaseForm}
              </div>
            </div>
          )}
        </SectionFilterChildren>
      </ExpandableCard>
    </SectionFilterProvider>
  );
}