"use client";

import type {
  HobbyDetail,
  PresetCustomFieldTemplate,
  HobbySeriesDetail,
  HobbySession,
  HobbySessionDetail,
  HobbySessionDetailIngredient,
  HobbySessionDetailMetricReading,
} from "@aegis/types";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type FormEvent, type JSX } from "react";
import {
  type BrewDayChecklist,
  type BrewDayData,
  getBrewDayHighlights,
  getBrewDayMissingItems,
  getBrewDayReadinessLabel,
  getRecommendedPitchTemperature,
  isBeerBrewingHobby,
  mergeBrewDayCustomFields,
  resolveBrewDayData,
} from "../lib/hobby-brewing";
import {
  createHobbyMetricReading,
  createHobbySessionIngredient,
  deleteHobbyMetricReading,
  deleteHobbySessionIngredient,
  reorderHobbySessionStepsOrdered,
  updateHobbySession,
  updateHobbySessionStep,
} from "../lib/api";
import { useFormattedDate } from "../lib/formatted-date";
import { toHouseholdDateInputValue, fromHouseholdDateInput } from "../lib/date-input-utils";
import { useTimezone } from "../lib/timezone-context";
import { Card } from "./card";
import { EntryTipsSurface } from "./entry-system";
import { HobbySessionStageManager } from "./hobby-session-stage-manager";
import { InlineError } from "./inline-error";
import { SessionActivityLogSection } from "./session-activity-log-section";
import { SessionRatingForm } from "./session-rating-form";
import { SessionStepList } from "./session-step-list";

type HobbySessionDetailProps = {
  householdId: string;
  hobbyId: string;
  hobby: HobbyDetail;
  session: HobbySessionDetail;
  series: HobbySeriesDetail | null;
  deleteHobbySessionAction: (formData: FormData) => Promise<void>;
};

type IngredientFormState = {
  name: string;
  quantityUsed: string;
  unit: string;
  unitCost: string;
  inventoryItemId: string;
  notes: string;
};

type MetricFormState = {
  value: string;
  readingDate: string;
  notes: string;
};

const defaultMetricForm = (timezone = "UTC"): MetricFormState => ({
  value: "",
  readingDate: toHouseholdDateInputValue(new Date().toISOString(), timezone),
  notes: "",
});

const defaultIngredientForm = (): IngredientFormState => ({
  name: "",
  quantityUsed: "",
  unit: "",
  unitCost: "",
  inventoryItemId: "",
  notes: "",
});

const brewDayNumericFields: Array<{ key: keyof BrewDayData; label: string; step?: string; min?: number }> = [
  { key: "batchVolumeTargetGallons", label: "Target batch volume (gal)", step: "0.1", min: 0 },
  { key: "volumeIntoFermenterGallons", label: "Volume into fermenter (gal)", step: "0.1", min: 0 },
  { key: "strikeWaterGallons", label: "Strike water (gal)", step: "0.1", min: 0 },
  { key: "spargeWaterGallons", label: "Sparge water (gal)", step: "0.1", min: 0 },
  { key: "strikeTempTargetF", label: "Strike temp target (F)", step: "0.1" },
  { key: "strikeTempActualF", label: "Strike temp actual (F)", step: "0.1" },
  { key: "mashTempTargetF", label: "Mash temp target (F)", step: "0.1" },
  { key: "mashTempActualF", label: "Mash temp actual (F)", step: "0.1" },
  { key: "mashPh", label: "Mash pH", step: "0.01", min: 0 },
  { key: "preBoilVolumeTargetGallons", label: "Pre-boil volume target (gal)", step: "0.1", min: 0 },
  { key: "preBoilVolumeActualGallons", label: "Pre-boil volume actual (gal)", step: "0.1", min: 0 },
  { key: "preBoilGravityTarget", label: "Pre-boil gravity target", step: "0.001", min: 0 },
  { key: "preBoilGravityActual", label: "Pre-boil gravity actual", step: "0.001", min: 0 },
  { key: "boilMinutesPlanned", label: "Boil minutes planned", step: "1", min: 0 },
  { key: "boilMinutesActual", label: "Boil minutes actual", step: "1", min: 0 },
  { key: "whirlpoolMinutes", label: "Whirlpool minutes", step: "1", min: 0 },
  { key: "chillMinutes", label: "Chill minutes", step: "1", min: 0 },
  { key: "originalGravityTarget", label: "Target OG", step: "0.001", min: 0 },
  { key: "originalGravityActual", label: "Actual OG", step: "0.001", min: 0 },
  { key: "pitchTempF", label: "Pitch temp (F)", step: "0.1" },
  { key: "fermentationTempLowF", label: "Fermentation low (F)", step: "0.1" },
  { key: "fermentationTempHighF", label: "Fermentation high (F)", step: "0.1" },
];

const brewDayTextFields: Array<{ key: keyof BrewDayData; label: string; placeholder?: string }> = [
  { key: "brewingMethod", label: "Brewing method", placeholder: "All grain, extract, BIAB, no-sparge" },
  { key: "brewhouse", label: "Brewhouse", placeholder: "System, kettle, or setup used" },
  { key: "waterSource", label: "Water source", placeholder: "Filtered tap, RO, spring" },
  { key: "waterProfile", label: "Water profile", placeholder: "Target salts or profile notes" },
  { key: "yeastName", label: "Yeast", placeholder: "Strain or lot used" },
  { key: "yeastStarter", label: "Starter and oxygenation", placeholder: "Starter size, rehydration, O2 notes" },
];

const brewDayChecklistFields: Array<{ key: keyof BrewDayChecklist; label: string }> = [
  { key: "equipmentReady", label: "Equipment staged" },
  { key: "waterAdjusted", label: "Water adjusted" },
  { key: "fermenterSanitized", label: "Fermenter sanitized" },
  { key: "mashComplete", label: "Mash complete" },
  { key: "boilComplete", label: "Boil complete" },
  { key: "wortChilled", label: "Wort chilled" },
  { key: "yeastPitched", label: "Yeast pitched" },
  { key: "cleanupComplete", label: "Cleanup complete" },
];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "pill pill--success";
    case "completed":
      return "pill pill--success";
    case "paused":
      return "pill pill--warning";
    case "planned":
      return "pill pill--muted";
    default:
      return "pill";
  }
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatGravity(value: number | undefined): string {
  if (value == null) {
    return "-";
  }

  return value.toFixed(3);
}

function mergeSessionSummary(previous: HobbySessionDetail, updated: HobbySession): HobbySessionDetail {
  return {
    ...previous,
    ...updated,
  };
}

export function HobbySessionDetail({
  householdId,
  hobbyId,
  hobby,
  session,
  series,
  deleteHobbySessionAction,
}: HobbySessionDetailProps): JSX.Element {
  const { formatDate, formatDateTime } = useFormattedDate();
  const { timezone } = useTimezone();
  const [sessionState, setSessionState] = useState(session);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingStepIds, setPendingStepIds] = useState<string[]>([]);
  const [ingredientFormOpen, setIngredientFormOpen] = useState(false);
  const [ingredientForm, setIngredientForm] = useState<IngredientFormState>(defaultIngredientForm);
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [deletingIngredientId, setDeletingIngredientId] = useState<string | null>(null);
  const [metricForms, setMetricForms] = useState<Record<string, MetricFormState>>({});
  const [pendingMetricIds, setPendingMetricIds] = useState<string[]>([]);
  const [deletingReadingId, setDeletingReadingId] = useState<string | null>(null);
  const [customFieldDraft, setCustomFieldDraft] = useState<Record<string, unknown>>(
    () => ({ ...(session.customFields as Record<string, unknown> ?? {}) })
  );
  const [customFieldSaving, setCustomFieldSaving] = useState(false);
  const [customFieldSaved, setCustomFieldSaved] = useState(false);
  const [brewDayDraft, setBrewDayDraft] = useState<BrewDayData>(() => resolveBrewDayData(session.customFields, hobby));
  const [brewDaySaving, setBrewDaySaving] = useState(false);
  const [brewDaySaved, setBrewDaySaved] = useState(false);
  const [notesDraft, setNotesDraft] = useState(session.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    setSessionState(session);
    setBrewDayDraft(resolveBrewDayData(session.customFields, hobby));
    setNotesDraft(session.notes ?? "");
    setCustomFieldDraft({ ...(session.customFields as Record<string, unknown> ?? {}) });
  }, [hobby, session]);

  useEffect(() => {
    if (!notesSaved) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setNotesSaved(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [notesSaved]);

  useEffect(() => {
    if (!brewDaySaved) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setBrewDaySaved(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [brewDaySaved]);

  const pipelineSteps = useMemo(
    () => [...hobby.statusPipeline].sort((left, right) => left.sortOrder - right.sortOrder),
    [hobby.statusPipeline],
  );
  const isBrewingSession = useMemo(() => isBeerBrewingHobby(hobby), [hobby]);
  const persistedBrewDay = useMemo(
    () => resolveBrewDayData(sessionState.customFields, hobby),
    [hobby, sessionState.customFields],
  );
  const brewDayHighlights = useMemo(() => getBrewDayHighlights(brewDayDraft), [brewDayDraft]);
  const brewDayMissingItems = useMemo(() => getBrewDayMissingItems(brewDayDraft), [brewDayDraft]);
  const brewDayReadinessLabel = useMemo(() => getBrewDayReadinessLabel(brewDayDraft), [brewDayDraft]);
  const previousSeriesBatch = useMemo(() => {
    const currentBatchNumber = sessionState.batchNumber;

    if (!series || currentBatchNumber == null) {
      return null;
    }

    return [...series.sessions]
      .filter((item) => item.id !== sessionState.id && item.batchNumber != null && item.batchNumber < currentBatchNumber)
      .sort((left, right) => (right.batchNumber ?? 0) - (left.batchNumber ?? 0))[0] ?? null;
  }, [series, sessionState.batchNumber, sessionState.id]);
  const previousMetricComparisons = useMemo(() => {
    if (!previousSeriesBatch) {
      return [];
    }

    return sessionState.metricReadings
      .map((reading) => {
        const previousReading = previousSeriesBatch.metricReadings.find(
          (candidate) => candidate.metricDefinitionId === reading.metricDefinitionId,
        );

        if (!previousReading) {
          return null;
        }

        return {
          id: reading.id,
          metricName: reading.metricName,
          metricUnit: reading.metricUnit,
          currentValue: reading.value,
          previousValue: previousReading.value,
          delta: reading.value - previousReading.value,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 6);
  }, [previousSeriesBatch, sessionState.metricReadings]);
  const recommendedPitchTemp = useMemo(() => getRecommendedPitchTemperature(brewDayDraft), [brewDayDraft]);
  const brewDayHasChanges = useMemo(() => {
    const nextCustomFields = mergeBrewDayCustomFields(sessionState.customFields, brewDayDraft);
    return JSON.stringify(nextCustomFields) !== JSON.stringify(sessionState.customFields);
  }, [brewDayDraft, sessionState.customFields]);
  const currentPipelineIndex = pipelineSteps.findIndex((step) => step.id === sessionState.pipelineStepId);
  const currentPipelineStep = currentPipelineIndex >= 0 ? pipelineSteps[currentPipelineIndex] : null;
  const sortedSteps = useMemo(
    () => [...sessionState.steps].sort((left, right) => left.sortOrder - right.sortOrder),
    [sessionState.steps],
  );
  const completedSteps = sortedSteps.filter((step) => step.isCompleted).length;
  const progressPercent = sortedSteps.length > 0 ? (completedSteps / sortedSteps.length) * 100 : 0;
  const totalIngredientCost = sessionState.ingredients.reduce((sum, ingredient) => (
    ingredient.unitCost == null ? sum : sum + ingredient.quantityUsed * ingredient.unitCost
  ), 0);

  const ensureMetricForm = (metricId: string): MetricFormState => metricForms[metricId] ?? defaultMetricForm(timezone);

  const updateSessionSummary = (updated: HobbySession): void => {
    setSessionState((previous) => mergeSessionSummary(previous, updated));
  };

  const resolveInventoryItem = (inventoryItemId: string | null) => {
    if (!inventoryItemId) {
      return null;
    }

    return hobby.inventoryLinks.find((link) => link.inventoryItemId === inventoryItemId)?.inventoryItem ?? null;
  };

  const handleDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    const formData = new FormData(event.currentTarget);
    startDeleteTransition(async () => {
      try {
        await deleteHobbySessionAction(formData);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to delete session.");
      }
    });
  };

  const toggleStep = async (step: HobbySessionDetail["steps"][number]) => {
    const updated = await updateHobbySessionStep(
      householdId,
      hobbyId,
      sessionState.id,
      step.id,
      { isCompleted: !step.isCompleted },
    );

    setSessionState((previous) => ({
      ...previous,
      steps: previous.steps.map((candidate) => candidate.id === step.id ? updated : candidate),
    }));
  };

  const handleStepReorder = async (newIds: string[]) => {
    const previousSteps = sessionState.steps;
    const reordered = newIds.map((id) => previousSteps.find((s) => s.id === id)!);
    setSessionState((current) => ({
      ...current,
      steps: reordered.map((step, index) => ({ ...step, sortOrder: index })),
    }));
    try {
      await reorderHobbySessionStepsOrdered(householdId, hobbyId, sessionState.id, newIds);
    } catch (error) {
      setSessionState((current) => ({ ...current, steps: previousSteps }));
      setErrorMessage(error instanceof Error ? error.message : "Failed to reorder steps.");
    }
  };

  const handleIngredientSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingIngredient(true);
    setErrorMessage(null);

    try {
      const created = await createHobbySessionIngredient(householdId, hobbyId, sessionState.id, {
        name: ingredientForm.name,
        quantityUsed: Number(ingredientForm.quantityUsed),
        unit: ingredientForm.unit,
        ...(ingredientForm.unitCost ? { unitCost: Number(ingredientForm.unitCost) } : {}),
        ...(ingredientForm.inventoryItemId ? { inventoryItemId: ingredientForm.inventoryItemId } : {}),
        ...(ingredientForm.notes ? { notes: ingredientForm.notes } : {}),
      });

      const ingredient: HobbySessionDetailIngredient = {
        ...created,
        inventoryItem: resolveInventoryItem(created.inventoryItemId),
      };

      setSessionState((previous) => ({
        ...previous,
        ingredients: [...previous.ingredients, ingredient],
      }));
      setIngredientForm(defaultIngredientForm());
      setIngredientFormOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add ingredient.");
    } finally {
      setAddingIngredient(false);
    }
  };

  const handleIngredientDelete = async (ingredientId: string) => {
    if (deletingIngredientId === ingredientId) {
      return;
    }

    setDeletingIngredientId(ingredientId);
    setErrorMessage(null);

    try {
      await deleteHobbySessionIngredient(householdId, hobbyId, sessionState.id, ingredientId);
      setSessionState((previous) => ({
        ...previous,
        ingredients: previous.ingredients.filter((ingredient) => ingredient.id !== ingredientId),
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove ingredient.");
    } finally {
      setDeletingIngredientId(null);
    }
  };

  const handleMetricFormChange = (metricId: string, key: keyof MetricFormState, value: string) => {
    setMetricForms((previous) => ({
      ...previous,
      [metricId]: {
        ...ensureMetricForm(metricId),
        [key]: value,
      },
    }));
  };

  const handleMetricSubmit = async (event: FormEvent<HTMLFormElement>, metricId: string) => {
    event.preventDefault();
    if (pendingMetricIds.includes(metricId)) {
      return;
    }

    const form = ensureMetricForm(metricId);
    setPendingMetricIds((previous) => [...previous, metricId]);
    setErrorMessage(null);

    try {
      const created = await createHobbyMetricReading(householdId, hobbyId, metricId, {
        value: Number(form.value),
        readingDate: fromHouseholdDateInput(form.readingDate, timezone) ?? new Date().toISOString(),
        sessionId: sessionState.id,
        ...(form.notes ? { notes: form.notes } : {}),
      });
      const metric = hobby.metricDefinitions.find((definition) => definition.id === metricId);
      const reading: HobbySessionDetailMetricReading = {
        ...created,
        metricName: metric?.name ?? "Metric",
        metricUnit: metric?.unit ?? "",
      };
      setSessionState((previous) => ({
        ...previous,
        metricReadings: [reading, ...previous.metricReadings],
      }));
      setMetricForms((previous) => ({
        ...previous,
        [metricId]: defaultMetricForm(timezone),
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add metric reading.");
    } finally {
      setPendingMetricIds((previous) => previous.filter((candidate) => candidate !== metricId));
    }
  };

  const handleMetricDelete = async (metricId: string, readingId: string) => {
    if (deletingReadingId === readingId) {
      return;
    }

    setDeletingReadingId(readingId);
    setErrorMessage(null);

    try {
      await deleteHobbyMetricReading(householdId, hobbyId, metricId, readingId);
      setSessionState((previous) => ({
        ...previous,
        metricReadings: previous.metricReadings.filter((reading) => reading.id !== readingId),
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete metric reading.");
    } finally {
      setDeletingReadingId(null);
    }
  };

  useEffect(() => {
    if (!customFieldSaved) return undefined;
    const id = window.setTimeout(() => setCustomFieldSaved(false), 1800);
    return () => window.clearTimeout(id);
  }, [customFieldSaved]);

  const saveCustomField = async (key: string, value: unknown) => {
    if (customFieldSaving) return;
    setCustomFieldSaving(true);
    setErrorMessage(null);
    try {
      const merged = { ...(sessionState.customFields as Record<string, unknown> ?? {}), [key]: value };
      const updated = await updateHobbySession(householdId, hobbyId, sessionState.id, { customFields: merged });
      updateSessionSummary(updated);
      setCustomFieldDraft({ ...(updated.customFields as Record<string, unknown> ?? {}) });
      setCustomFieldSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save field.");
    } finally {
      setCustomFieldSaving(false);
    }
  };

  const saveNotes = async () => {
    const normalized = notesDraft.trim();
    const previousNotes = sessionState.notes ?? "";
    if (notesSaving || normalized === previousNotes.trim()) {
      return;
    }

    setNotesSaving(true);
    setErrorMessage(null);

    try {
      const updated = await updateHobbySession(householdId, hobbyId, sessionState.id, {
        notes: normalized ? normalized : null,
      });
      updateSessionSummary(updated);
      setNotesDraft(updated.notes ?? "");
      setNotesSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save notes.");
    } finally {
      setNotesSaving(false);
    }
  };

  const handleBrewDayTextChange = (key: keyof BrewDayData, value: string) => {
    setBrewDayDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleBrewDayNumberChange = (key: keyof BrewDayData, value: string) => {
    setBrewDayDraft((previous) => ({
      ...previous,
      [key]: value === "" ? undefined : Number(value),
    }));
  };

  const handleBrewDayChecklistChange = (key: keyof BrewDayChecklist, checked: boolean) => {
    setBrewDayDraft((previous) => ({
      ...previous,
      checklist: {
        ...previous.checklist,
        [key]: checked,
      },
    }));
  };

  const saveBrewDay = async () => {
    if (!brewDayHasChanges || brewDaySaving) {
      return;
    }

    setBrewDaySaving(true);
    setErrorMessage(null);

    try {
      const updated = await updateHobbySession(householdId, hobbyId, sessionState.id, {
        customFields: mergeBrewDayCustomFields(sessionState.customFields, brewDayDraft),
      });
      updateSessionSummary(updated);
      setBrewDayDraft(resolveBrewDayData(updated.customFields, hobby));
      setBrewDaySaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save brew day details.");
    } finally {
      setBrewDaySaving(false);
    }
  };

  const updateRating = async (rating: number) => {
    const updated = await updateHobbySession(householdId, hobbyId, sessionState.id, { rating });
    updateSessionSummary(updated);
  };

  return (
    <>
    <EntryTipsSurface
      householdId={householdId}
      queries={[
        { entityType: "hobby_session", entityId: sessionState.id },
        { entityType: "hobby", entityId: hobbyId }
      ]}
      entryHrefBuilder={(entry) => `/hobbies/${hobbyId}/sessions/${sessionState.id}#entry-${entry.id}`}
    />
    <div className="resource-layout">
      <div className="resource-layout__primary session-detail-stack">
        <InlineError message={errorMessage} />

        <HobbySessionStageManager
          householdId={householdId}
          hobbyId={hobbyId}
          hobby={hobby}
          session={sessionState}
          onSessionChange={updateSessionSummary}
          onError={setErrorMessage}
        />

        {series ? (
          <Card title="Series Context">
            <div className="session-section-stack">
              <div className="session-series-summary">
                <div>
                  <strong>
                    <Link href={`/hobbies/${hobbyId}/series/${series.id}`} className="text-link">
                      {series.name}
                    </Link>
                  </strong>
                  <p className="session-brew-summary__caption">
                    Batch {sessionState.batchNumber ?? "-"} of {series.batchCount}
                  </p>
                </div>
                {series.bestBatchSessionId === sessionState.id ? <span className="pill pill--success">Best batch</span> : null}
              </div>

              {previousSeriesBatch ? (
                <div className="session-series-compare">
                  <div className="session-series-compare__header">
                    <strong>Compared with previous batch</strong>
                    <Link href={`/hobbies/${hobbyId}/series/${series.id}`} className="text-link">
                      Open series
                    </Link>
                  </div>
                  <p className="session-brew-summary__caption">
                    {previousSeriesBatch.name} · Batch {previousSeriesBatch.batchNumber ?? "-"}
                  </p>
                  {previousMetricComparisons.length > 0 ? (
                    <div className="session-series-compare__metrics">
                      {previousMetricComparisons.map((item) => (
                        <div key={item.id} className="session-series-compare__metric">
                          <dt>{item.metricName}</dt>
                          <dd>
                            {item.currentValue} {item.metricUnit} vs {item.previousValue} {item.metricUnit}
                          </dd>
                          <span className={item.delta >= 0 ? "pill pill--success" : "pill pill--warning"}>
                            {item.delta > 0 ? "+" : ""}{item.delta.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="panel__empty">No overlapping metrics to compare with the previous batch.</p>
                  )}
                </div>
              ) : (
                <p className="panel__empty">No previous batch is available for comparison yet.</p>
              )}
            </div>
          </Card>
        ) : null}

        {isBrewingSession ? (
          <div id="brew-day-workspace">
            <Card
              title="Brew Day Workspace"
              actions={<span className={`session-saved-indicator${brewDaySaved ? " is-visible" : ""}`}>Saved</span>}
            >
              <div className="session-section-stack">
                <div className="session-brew-summary">
                  <div className="session-brew-summary__topline">
                    <strong>{brewDayReadinessLabel}</strong>
                    {brewDayMissingItems.length > 0 ? (
                      <span className="pill pill--warning">Missing {brewDayMissingItems.length}</span>
                    ) : (
                      <span className="pill pill--success">All core brew-day checks captured</span>
                    )}
                  </div>

                  {brewDayHighlights.length > 0 ? (
                    <div className="session-brew-pill-row">
                      {brewDayHighlights.map((item) => (
                        <span key={item} className="pill pill--muted">{item}</span>
                      ))}
                    </div>
                  ) : null}

                  {brewDayMissingItems.length > 0 ? (
                    <p className="session-brew-summary__caption">
                      Missing: {brewDayMissingItems.join(", ")}.
                    </p>
                  ) : null}
                </div>

                <div className="session-brew-details-grid">
                  <div>
                    <dt>Target OG</dt>
                    <dd>{formatGravity(brewDayDraft.originalGravityTarget ?? persistedBrewDay.originalGravityTarget)}</dd>
                  </div>
                  <div>
                    <dt>Actual OG</dt>
                    <dd>{formatGravity(brewDayDraft.originalGravityActual)}</dd>
                  </div>
                  <div>
                    <dt>Pitch temp target</dt>
                    <dd>{recommendedPitchTemp != null ? `${recommendedPitchTemp.toFixed(1)}F` : "-"}</dd>
                  </div>
                  <div>
                    <dt>Fermentation range</dt>
                    <dd>
                      {brewDayDraft.fermentationTempLowF != null || brewDayDraft.fermentationTempHighF != null
                        ? `${brewDayDraft.fermentationTempLowF ?? "-"}F to ${brewDayDraft.fermentationTempHighF ?? "-"}F`
                        : "-"}
                    </dd>
                  </div>
                </div>

                <div className="session-brew-grid">
                  {brewDayTextFields.map((field) => (
                    <label key={String(field.key)} className="field">
                      <span>{field.label}</span>
                      <input
                        type="text"
                        value={typeof brewDayDraft[field.key] === "string" ? (brewDayDraft[field.key] as string) : ""}
                        onChange={(event) => handleBrewDayTextChange(field.key, event.target.value)}
                        onBlur={() => void saveBrewDay()}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}

                  {brewDayNumericFields.map((field) => (
                    <label key={String(field.key)} className="field">
                      <span>{field.label}</span>
                      <input
                        type="number"
                        min={field.min}
                        step={field.step}
                        value={typeof brewDayDraft[field.key] === "number" ? String(brewDayDraft[field.key]) : ""}
                        onChange={(event) => handleBrewDayNumberChange(field.key, event.target.value)}
                        onBlur={() => void saveBrewDay()}
                      />
                    </label>
                  ))}

                  <label className="field field--full">
                    <span>Brew Day Notes</span>
                    <textarea
                      rows={5}
                      value={brewDayDraft.notes ?? ""}
                      onChange={(event) => handleBrewDayTextChange("notes", event.target.value)}
                      onBlur={() => void saveBrewDay()}
                      placeholder="Record water adjustments, hop timing changes, runoff issues, oxygenation, cleanup, and anything worth repeating next brew day."
                    />
                  </label>
                </div>

                <div className="session-brew-checklist">
                  {brewDayChecklistFields.map((item) => (
                    <label key={item.key} className="session-brew-checklist__item">
                      <input
                        type="checkbox"
                        checked={Boolean(brewDayDraft.checklist?.[item.key])}
                        onChange={(event) => {
                          handleBrewDayChecklistChange(item.key, event.target.checked);
                          window.setTimeout(() => {
                            void saveBrewDay();
                          }, 0);
                        }}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="session-inline-actions">
                  <button type="button" className="button button--secondary" onClick={() => void saveBrewDay()} disabled={brewDaySaving || !brewDayHasChanges}>
                    {brewDaySaving ? "Saving..." : "Save Brew Day"}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {!isBrewingSession && hobby.fieldDefinitions.length > 0 ? (
          <Card
            title="Session Fields"
            actions={<span className={`session-saved-indicator${customFieldSaved ? " is-visible" : ""}`}>Saved</span>}
          >
            <div className="session-custom-fields-grid">
              {[...(hobby.fieldDefinitions as PresetCustomFieldTemplate[])].sort((a, b) => a.order - b.order).map((field) => {
                const value = customFieldDraft[field.key];
                const strVal = value == null ? "" : String(value);

                if (field.type === "boolean") {
                  return (
                    <label key={field.key} className={`field${field.wide ? " field--wide" : ""}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => {
                          setCustomFieldDraft((prev) => ({ ...prev, [field.key]: e.target.checked }));
                          void saveCustomField(field.key, e.target.checked);
                        }}
                      />
                      <span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                    </label>
                  );
                }

                if (field.type === "select" && field.options.length > 0) {
                  return (
                    <label key={field.key} className={`field${field.wide ? " field--wide" : ""}`}>
                      <span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                      <select
                        value={strVal}
                        onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        onBlur={(e) => void saveCustomField(field.key, e.target.value)}
                      >
                        <option value="">—</option>
                        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {field.helpText ? <span className="field__help">{field.helpText}</span> : null}
                    </label>
                  );
                }

                if (field.type === "textarea") {
                  return (
                    <label key={field.key} className={`field${field.wide ? " field--wide" : ""} field--wide`}>
                      <span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                      <textarea
                        value={strVal}
                        placeholder={field.placeholder ?? ""}
                        rows={3}
                        onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        onBlur={(e) => void saveCustomField(field.key, e.target.value || null)}
                      />
                      {field.helpText ? <span className="field__help">{field.helpText}</span> : null}
                    </label>
                  );
                }

                const inputType = field.type === "number" || field.type === "currency" ? "number"
                  : field.type === "date" ? "date"
                  : field.type === "url" ? "url"
                  : "text";

                return (
                  <label key={field.key} className={`field${field.wide ? " field--wide" : ""}`}>
                    <span>{field.label}{field.unit ? ` (${field.unit})` : ""}</span>
                    <input
                      type={inputType}
                      value={strVal}
                      placeholder={field.placeholder ?? ""}
                      onChange={(e) => setCustomFieldDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      onBlur={(e) => void saveCustomField(field.key, e.target.value || null)}
                    />
                    {field.helpText ? <span className="field__help">{field.helpText}</span> : null}
                  </label>
                );
              })}
            </div>
          </Card>
        ) : null}

        <SessionStepList
          steps={sortedSteps}
          completedSteps={completedSteps}
          progressPercent={progressPercent}
          onToggleStep={toggleStep}
          onReorder={handleStepReorder}
          onError={setErrorMessage}
          formatDateTime={formatDateTime}
          titleCase={titleCase}
        />

        <Card
          title="Ingredients"
          actions={
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => setIngredientFormOpen((previous) => !previous)}
            >
              {ingredientFormOpen ? "Cancel" : "Add Ingredient"}
            </button>
          }
        >
          <div className="session-section-stack">
            {sessionState.ingredients.length === 0 ? <p className="panel__empty">No ingredients in this session.</p> : null}

            {sessionState.ingredients.length > 0 ? (
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Unit Cost</th>
                    <th>Linked Item</th>
                    <th>Notes</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sessionState.ingredients.map((ingredient) => (
                    <tr key={ingredient.id}>
                      <td>{ingredient.name}</td>
                      <td>{ingredient.quantityUsed}</td>
                      <td>{ingredient.unit}</td>
                      <td>{formatCurrency(ingredient.unitCost)}</td>
                      <td>
                        {ingredient.inventoryItem ? `${ingredient.inventoryItem.name} (${ingredient.inventoryItem.quantityOnHand} ${ingredient.inventoryItem.unit} on hand)` : "-"}
                      </td>
                      <td>{ingredient.notes ?? "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="button button--ghost button--sm"
                          onClick={() => void handleIngredientDelete(ingredient.id)}
                          disabled={deletingIngredientId === ingredient.id}
                        >
                          {deletingIngredientId === ingredient.id ? "..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <div className="session-total-row">
              <strong>Total Cost</strong>
              <strong>{formatCurrency(totalIngredientCost)}</strong>
            </div>

            <div className={`session-inline-form${ingredientFormOpen ? " session-inline-form--open" : ""}`}>
              <form onSubmit={handleIngredientSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={ingredientForm.name}
                      onChange={(event) => setIngredientForm((previous) => ({ ...previous, name: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredientForm.quantityUsed}
                      onChange={(event) => setIngredientForm((previous) => ({ ...previous, quantityUsed: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Unit</span>
                    <input
                      type="text"
                      value={ingredientForm.unit}
                      onChange={(event) => setIngredientForm((previous) => ({ ...previous, unit: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Unit Cost</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredientForm.unitCost}
                      onChange={(event) => setIngredientForm((previous) => ({ ...previous, unitCost: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Linked Item</span>
                    <select
                      value={ingredientForm.inventoryItemId}
                      onChange={(event) => setIngredientForm((previous) => ({ ...previous, inventoryItemId: event.target.value }))}
                    >
                      <option value="">None</option>
                      {hobby.inventoryLinks.map((link) => (
                        <option key={link.id} value={link.inventoryItemId}>
                          {link.inventoryItem.name} ({link.inventoryItem.quantityOnHand} {link.inventoryItem.unit} on hand)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field--full">
                    <span>Notes</span>
                    <textarea
                      rows={3}
                      value={ingredientForm.notes}
                      onChange={(event) => setIngredientForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="session-inline-actions" style={{ marginTop: 12 }}>
                  <button type="submit" className="button" disabled={addingIngredient}>
                    {addingIngredient ? "Adding..." : "Save Ingredient"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Card>

        <Card title="Metric Readings">
          <div className="session-metric-grid">
            {hobby.metricDefinitions.length === 0 ? <p className="panel__empty">No metric definitions configured for this hobby.</p> : null}

            {hobby.metricDefinitions.map((metric) => {
              const form = ensureMetricForm(metric.id);
              const readings = sessionState.metricReadings.filter((reading) => reading.metricDefinitionId === metric.id);
              return (
                <div key={metric.id} className="session-metric-card">
                  <div className="session-metric-card__header">
                    <strong>{metric.name}</strong>
                    <p>{metric.unit}</p>
                  </div>

                  <form onSubmit={(event) => void handleMetricSubmit(event, metric.id)}>
                    <div className="session-metric-form-row">
                      <label className="field">
                        <span>Value</span>
                        <input
                          type="number"
                          step="0.01"
                          value={form.value}
                          onChange={(event) => handleMetricFormChange(metric.id, "value", event.target.value)}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Date</span>
                        <input
                          type="date"
                          value={form.readingDate}
                          onChange={(event) => handleMetricFormChange(metric.id, "readingDate", event.target.value)}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Notes</span>
                        <input
                          type="text"
                          value={form.notes}
                          onChange={(event) => handleMetricFormChange(metric.id, "notes", event.target.value)}
                        />
                      </label>
                      <div className="session-metric-form-submit">
                        <button
                          type="submit"
                          className="button button--secondary"
                          disabled={pendingMetricIds.includes(metric.id)}
                        >
                          {pendingMetricIds.includes(metric.id) ? "Saving..." : "Record Reading"}
                        </button>
                      </div>
                    </div>
                  </form>

                  {readings.length === 0 ? (
                    <p className="panel__empty">No readings recorded for this session.</p>
                  ) : (
                    <table className="data-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th>Value</th>
                          <th>Date</th>
                          <th>Notes</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {readings.map((reading) => (
                          <tr key={reading.id}>
                            <td><strong>{reading.value}</strong> {reading.metricUnit}</td>
                            <td>{formatDate(reading.readingDate)}</td>
                            <td>{reading.notes ?? "-"}</td>
                            <td>
                              <button
                                type="button"
                                className="button button--ghost button--sm"
                                onClick={() => void handleMetricDelete(metric.id, reading.id)}
                                disabled={deletingReadingId === reading.id}
                              >
                                {deletingReadingId === reading.id ? "..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <SessionActivityLogSection
          householdId={householdId}
          hobbyId={hobbyId}
          sessionId={sessionState.id}
        />
      </div>

      <aside className="resource-layout__aside session-aside-stack">
        <Card title="Session Info">
          <div className="data-list">
            <div>
              <dt>Status</dt>
              <dd><span className={statusBadgeClass(sessionState.status)}>{sessionState.status}</span></dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatDate(sessionState.startDate)}</dd>
            </div>
            {sessionState.completedDate ? (
              <div>
                <dt>Completed</dt>
                <dd>{formatDate(sessionState.completedDate)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Total Cost</dt>
              <dd>{formatCurrency(totalIngredientCost)}</dd>
            </div>
            {sessionState.recipeName ? (
              <div>
                <dt>Recipe</dt>
                <dd>
                  <Link href={`/hobbies/${hobbyId}?tab=recipes`} className="text-link">
                    {sessionState.recipeName}
                  </Link>
                </dd>
              </div>
            ) : null}
          </div>

          <SessionRatingForm rating={sessionState.rating} onRate={updateRating} onError={setErrorMessage} />

          <form onSubmit={handleDelete} style={{ marginTop: 16 }}>
            <input type="hidden" name="householdId" value={householdId} />
            <input type="hidden" name="hobbyId" value={hobbyId} />
            <input type="hidden" name="sessionId" value={sessionState.id} />
            <button type="submit" className="button button--danger" disabled={isDeletePending}>
              {isDeletePending ? "Deleting..." : "Delete Session"}
            </button>
          </form>
        </Card>

        <Card
          title="Notes"
          actions={<span className={`session-saved-indicator${notesSaved ? " is-visible" : ""}`}>Saved</span>}
        >
          <div className="session-section-stack">
            <label className="field">
              <span>Session Notes</span>
              <textarea
                rows={8}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onBlur={() => void saveNotes()}
                placeholder="Capture setup, observations, or next steps."
              />
            </label>
            <div className="session-inline-actions">
              <button type="button" className="button button--secondary" onClick={() => void saveNotes()} disabled={notesSaving}>
                {notesSaving ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </Card>

      </aside>
    </div>
    </>
  );
}
