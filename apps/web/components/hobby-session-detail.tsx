"use client";

import type {
  HobbyDetail,
  HobbyLog,
  HobbyLogType,
  HobbySession,
  HobbySessionDetail,
  HobbySessionDetailIngredient,
  HobbySessionDetailMetricReading,
  HobbySessionStep,
} from "@lifekeeper/types";
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
  createHobbyLog,
  createHobbyMetricReading,
  createHobbySessionIngredient,
  deleteHobbyLog,
  deleteHobbyMetricReading,
  deleteHobbySessionIngredient,
  updateHobbyLog,
  updateHobbySession,
  updateHobbySessionStep,
} from "../lib/api";
import { Card } from "./card";

type HobbySessionDetailProps = {
  householdId: string;
  hobbyId: string;
  hobby: HobbyDetail;
  session: HobbySessionDetail;
  advanceHobbySessionAction: (formData: FormData) => Promise<void>;
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

type LogFormState = {
  title: string;
  content: string;
  logDate: string;
  logType: HobbyLogType;
};

const todayInputValue = (): string => new Date().toISOString().slice(0, 10);

const defaultIngredientForm = (): IngredientFormState => ({
  name: "",
  quantityUsed: "",
  unit: "",
  unitCost: "",
  inventoryItemId: "",
  notes: "",
});

const defaultMetricForm = (): MetricFormState => ({
  value: "",
  readingDate: todayInputValue(),
  notes: "",
});

const defaultLogForm = (): LogFormState => ({
  title: "",
  content: "",
  logDate: todayInputValue(),
  logType: "note",
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

function formatDate(value: string | null | undefined, fallback = "-"): string {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, fallback = "-"): string {
  if (!value) {
    return fallback;
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
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
  advanceHobbySessionAction,
  deleteHobbySessionAction,
}: HobbySessionDetailProps): JSX.Element {
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
  const [brewDayDraft, setBrewDayDraft] = useState<BrewDayData>(() => resolveBrewDayData(session.customFields, hobby));
  const [brewDaySaving, setBrewDaySaving] = useState(false);
  const [brewDaySaved, setBrewDaySaved] = useState(false);
  const [notesDraft, setNotesDraft] = useState(session.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [ratingPending, setRatingPending] = useState<number | null>(null);
  const [logFormOpen, setLogFormOpen] = useState(false);
  const [logForm, setLogForm] = useState<LogFormState>(defaultLogForm);
  const [addingLog, setAddingLog] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logDrafts, setLogDrafts] = useState<Record<string, LogFormState>>({});
  const [savingLogId, setSavingLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [isAdvancePending, startAdvanceTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    setSessionState(session);
    setBrewDayDraft(resolveBrewDayData(session.customFields, hobby));
    setNotesDraft(session.notes ?? "");
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
  const sessionLogs = useMemo(
    () => sessionState.logs.filter((entry) => entry.sessionId === sessionState.id),
    [sessionState.id, sessionState.logs],
  );
  const completedSteps = sortedSteps.filter((step) => step.isCompleted).length;
  const progressPercent = sortedSteps.length > 0 ? (completedSteps / sortedSteps.length) * 100 : 0;
  const totalIngredientCost = sessionState.ingredients.reduce((sum, ingredient) => (
    ingredient.unitCost == null ? sum : sum + ingredient.quantityUsed * ingredient.unitCost
  ), 0);

  const ensureMetricForm = (metricId: string): MetricFormState => metricForms[metricId] ?? defaultMetricForm();

  const updateSessionSummary = (updated: HobbySession): void => {
    setSessionState((previous) => mergeSessionSummary(previous, updated));
  };

  const resolveInventoryItem = (inventoryItemId: string | null) => {
    if (!inventoryItemId) {
      return null;
    }

    return hobby.inventoryLinks.find((link) => link.inventoryItemId === inventoryItemId)?.inventoryItem ?? null;
  };

  const handleBinaryStatusChange = async (status: "active" | "completed") => {
    if (statusPending || sessionState.status === status) {
      return;
    }

    setStatusPending(true);
    setErrorMessage(null);

    try {
      const updated = await updateHobbySession(householdId, hobbyId, sessionState.id, { status });
      updateSessionSummary(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update session status.");
    } finally {
      setStatusPending(false);
    }
  };

  const handleAdvance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPipelineStep || currentPipelineStep.isFinal) {
      return;
    }

    const nextStep = pipelineSteps[currentPipelineIndex + 1];
    if (!nextStep) {
      return;
    }

    setErrorMessage(null);
    const formData = new FormData(event.currentTarget);
    startAdvanceTransition(async () => {
      try {
        await advanceHobbySessionAction(formData);
        setSessionState((previous) => ({
          ...previous,
          status: nextStep.label,
          pipelineStepId: nextStep.id,
          completedDate: nextStep.isFinal ? new Date().toISOString() : previous.completedDate,
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to advance session.");
      }
    });
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

  const handleToggleStep = async (step: HobbySessionStep) => {
    if (pendingStepIds.includes(step.id)) {
      return;
    }

    setPendingStepIds((previous) => [...previous, step.id]);
    setErrorMessage(null);

    try {
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update session step.");
    } finally {
      setPendingStepIds((previous) => previous.filter((stepId) => stepId !== step.id));
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
        readingDate: toIsoDate(form.readingDate),
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
        [metricId]: defaultMetricForm(),
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

  const handleRating = async (rating: number) => {
    if (ratingPending === rating) {
      return;
    }

    setRatingPending(rating);
    setErrorMessage(null);

    try {
      const updated = await updateHobbySession(householdId, hobbyId, sessionState.id, { rating });
      updateSessionSummary(updated);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update rating.");
    } finally {
      setRatingPending(null);
    }
  };

  const handleLogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingLog(true);
    setErrorMessage(null);

    try {
      const created = await createHobbyLog(householdId, hobbyId, {
        sessionId: sessionState.id,
        content: logForm.content,
        logDate: toIsoDate(logForm.logDate),
        logType: logForm.logType,
        ...(logForm.title ? { title: logForm.title } : {}),
      });
      setSessionState((previous) => ({
        ...previous,
        logs: [created, ...previous.logs],
      }));
      setLogForm(defaultLogForm());
      setLogFormOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to add journal entry.");
    } finally {
      setAddingLog(false);
    }
  };

  const startLogEdit = (entry: HobbyLog) => {
    setEditingLogId(entry.id);
    setLogDrafts((previous) => ({
      ...previous,
      [entry.id]: {
        title: entry.title ?? "",
        content: entry.content,
        logDate: entry.logDate.slice(0, 10),
        logType: entry.logType,
      },
    }));
  };

  const handleLogDraftChange = (logId: string, key: keyof LogFormState, value: string) => {
    setLogDrafts((previous) => ({
      ...previous,
      [logId]: {
        ...(previous[logId] ?? defaultLogForm()),
        [key]: value,
      },
    }));
  };

  const handleLogSave = async (logId: string) => {
    const draft = logDrafts[logId];
    if (!draft || savingLogId === logId) {
      return;
    }

    setSavingLogId(logId);
    setErrorMessage(null);

    try {
      const updated = await updateHobbyLog(householdId, hobbyId, logId, {
        title: draft.title ? draft.title : null,
        content: draft.content,
        logDate: toIsoDate(draft.logDate),
        logType: draft.logType,
        sessionId: sessionState.id,
      });
      setSessionState((previous) => ({
        ...previous,
        logs: previous.logs.map((entry) => entry.id === logId ? updated : entry),
      }));
      setEditingLogId(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save journal entry.");
    } finally {
      setSavingLogId(null);
    }
  };

  const handleLogDelete = async (logId: string) => {
    if (deletingLogId === logId) {
      return;
    }

    setDeletingLogId(logId);
    setErrorMessage(null);

    try {
      await deleteHobbyLog(householdId, hobbyId, logId);
      setSessionState((previous) => ({
        ...previous,
        logs: previous.logs.filter((entry) => entry.id !== logId),
      }));
      if (editingLogId === logId) {
        setEditingLogId(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete journal entry.");
    } finally {
      setDeletingLogId(null);
    }
  };

  return (
    <div className="resource-layout">
      <div className="resource-layout__primary session-detail-stack">
        {errorMessage ? (
          <div className="panel">
            <div className="panel__body--padded">
              <p>{errorMessage}</p>
            </div>
          </div>
        ) : null}

        <Card title={hobby.lifecycleMode === "pipeline" ? "Pipeline" : "Status"}>
          <div className="session-flow-stack">
            {hobby.lifecycleMode === "pipeline" ? (
              <>
                <div className="hobby-pipeline-indicator">
                  {pipelineSteps.map((step, index) => {
                    const variant = index < currentPipelineIndex
                      ? "completed"
                      : index === currentPipelineIndex
                        ? "active"
                        : "upcoming";
                    return (
                      <div
                        key={step.id}
                        className={`hobby-pipeline-step hobby-pipeline-step--${variant}`}
                      >
                        {step.label}
                      </div>
                    );
                  })}
                </div>

                {sessionState.completedDate ? (
                  <p className="session-flow-caption">Session Completed</p>
                ) : (
                  <form onSubmit={handleAdvance}>
                    <input type="hidden" name="householdId" value={householdId} />
                    <input type="hidden" name="hobbyId" value={hobbyId} />
                    <input type="hidden" name="sessionId" value={sessionState.id} />
                    <button
                      type="submit"
                      className="button"
                      disabled={isAdvancePending || currentPipelineStep?.isFinal}
                    >
                      {isAdvancePending ? "Advancing..." : "Advance to Next Step"}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="session-status-toggle">
                <button
                  type="button"
                  className={sessionState.status === "active" ? "button" : "button button--secondary"}
                  onClick={() => void handleBinaryStatusChange("active")}
                  disabled={statusPending}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={sessionState.status === "completed" ? "button" : "button button--secondary"}
                  onClick={() => void handleBinaryStatusChange("completed")}
                  disabled={statusPending}
                >
                  {statusPending && sessionState.status !== "completed" ? "Saving..." : "Completed"}
                </button>
              </div>
            )}
          </div>
        </Card>

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

        <Card
          title="Steps"
          actions={<span className="pill">{completedSteps} / {sortedSteps.length}</span>}
        >
          <div className="session-step-stack">
            <div className="session-progress-summary">
              <strong>{completedSteps} of {sortedSteps.length} steps completed</strong>
              <div className="session-progress-bar" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {sortedSteps.length === 0 ? <p className="panel__empty">No steps in this session.</p> : null}

            <div className="session-step-list">
              {sortedSteps.map((step) => {
                const isPending = pendingStepIds.includes(step.id);
                return (
                  <div
                    key={step.id}
                    className={`session-step session-step--clickable${isPending ? " session-step--pending" : ""}`}
                  >
                    <button
                      type="button"
                      className={`session-step__checkbox${step.isCompleted ? " is-complete" : ""}`}
                      onClick={() => void handleToggleStep(step)}
                      disabled={isPending}
                      aria-label={step.isCompleted ? `Mark ${step.title} incomplete` : `Mark ${step.title} complete`}
                    >
                      {step.isCompleted ? "✓" : "○"}
                    </button>

                    <div className="session-step__content">
                      <div className="session-step__header">
                        <div className="session-step__title-group">
                          <strong className={`session-step__title${step.isCompleted ? " is-complete" : ""}`}>{step.title}</strong>
                          <span className="pill">{titleCase(step.stepType)}</span>
                          {step.durationMinutes != null ? <span className="pill">{step.durationMinutes} min</span> : null}
                        </div>
                        {step.completedAt ? <span className="pill">Completed {formatDateTime(step.completedAt)}</span> : null}
                      </div>

                      {step.description ? (
                        <details>
                          <summary>Description</summary>
                          <p className="session-step__description">{step.description}</p>
                        </details>
                      ) : null}

                      {step.notes ? <p className="session-step__notes">{step.notes}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

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

          <div className="session-rating-block" style={{ marginTop: 16 }}>
            <strong>Rating</strong>
            <div className="session-rating" role="radiogroup" aria-label="Session rating">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const filled = (sessionState.rating ?? 0) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`session-rating__star${filled ? " is-filled" : ""}`}
                    onClick={() => void handleRating(value)}
                    disabled={ratingPending != null}
                    aria-label={`Rate session ${value} out of 5`}
                  >
                    ★
                  </button>
                );
              })}
            </div>
          </div>

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

        <Card
          title="Journal Entries"
          actions={
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => setLogFormOpen((previous) => !previous)}
            >
              {logFormOpen ? "Cancel" : "Add Entry"}
            </button>
          }
        >
          <div className="session-section-stack">
            <div className={`session-inline-form${logFormOpen ? " session-inline-form--open" : ""}`}>
              <form onSubmit={handleLogSubmit}>
                <div className="form-grid">
                  <label className="field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={logForm.title}
                      onChange={(event) => setLogForm((previous) => ({ ...previous, title: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={logForm.logDate}
                      onChange={(event) => setLogForm((previous) => ({ ...previous, logDate: event.target.value }))}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <select
                      value={logForm.logType}
                      onChange={(event) => setLogForm((previous) => ({ ...previous, logType: event.target.value as HobbyLogType }))}
                    >
                      <option value="note">Note</option>
                      <option value="tasting">Tasting</option>
                      <option value="progress">Progress</option>
                      <option value="issue">Issue</option>
                    </select>
                  </label>
                  <label className="field field--full">
                    <span>Content</span>
                    <textarea
                      rows={4}
                      value={logForm.content}
                      onChange={(event) => setLogForm((previous) => ({ ...previous, content: event.target.value }))}
                      required
                    />
                  </label>
                </div>
                <div className="session-inline-actions" style={{ marginTop: 12 }}>
                  <button type="submit" className="button" disabled={addingLog}>
                    {addingLog ? "Saving..." : "Save Entry"}
                  </button>
                </div>
              </form>
            </div>

            {sessionLogs.length === 0 ? <p className="panel__empty">No journal entries for this session yet.</p> : null}

            <div className="session-log-list">
              {sessionLogs.map((entry) => {
                const isEditing = editingLogId === entry.id;
                const draft = logDrafts[entry.id];
                return (
                  <div key={entry.id} className={`session-log-entry session-log-entry--${entry.logType}`}>
                    {isEditing && draft ? (
                      <div className="session-section-stack">
                        <label className="field">
                          <span>Title</span>
                          <input
                            type="text"
                            value={draft.title}
                            onChange={(event) => handleLogDraftChange(entry.id, "title", event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Date</span>
                          <input
                            type="date"
                            value={draft.logDate}
                            onChange={(event) => handleLogDraftChange(entry.id, "logDate", event.target.value)}
                          />
                        </label>
                        <label className="field">
                          <span>Type</span>
                          <select
                            value={draft.logType}
                            onChange={(event) => handleLogDraftChange(entry.id, "logType", event.target.value)}
                          >
                            <option value="note">Note</option>
                            <option value="tasting">Tasting</option>
                            <option value="progress">Progress</option>
                            <option value="issue">Issue</option>
                          </select>
                        </label>
                        <label className="field">
                          <span>Content</span>
                          <textarea
                            rows={4}
                            value={draft.content}
                            onChange={(event) => handleLogDraftChange(entry.id, "content", event.target.value)}
                          />
                        </label>
                        <div className="session-inline-actions">
                          <button
                            type="button"
                            className="button button--secondary button--sm"
                            onClick={() => void handleLogSave(entry.id)}
                            disabled={savingLogId === entry.id}
                          >
                            {savingLogId === entry.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="button button--ghost button--sm"
                            onClick={() => setEditingLogId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="session-log-entry__topline">
                          <div className="session-step__title-group">
                            {entry.title ? <strong>{entry.title}</strong> : <strong>{titleCase(entry.logType)}</strong>}
                            <span className="pill">{entry.logType}</span>
                          </div>
                          <span>{formatDate(entry.logDate)}</span>
                        </div>
                        <p className="session-log-entry__content">{entry.content}</p>
                        <div className="session-inline-actions">
                          <button
                            type="button"
                            className="button button--ghost button--sm"
                            onClick={() => startLogEdit(entry)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="button button--ghost button--sm"
                            onClick={() => void handleLogDelete(entry.id)}
                            disabled={deletingLogId === entry.id}
                          >
                            {deletingLogId === entry.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}