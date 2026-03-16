import type { HobbyDetail } from "@lifekeeper/types";

type BrewingHobbyLike = Pick<HobbyDetail, "hobbyType" | "name" | "description" | "customFields">;

export type BrewDayChecklist = {
  equipmentReady: boolean;
  waterAdjusted: boolean;
  fermenterSanitized: boolean;
  mashComplete: boolean;
  boilComplete: boolean;
  wortChilled: boolean;
  yeastPitched: boolean;
  cleanupComplete: boolean;
};

export type BrewDayData = {
  brewingMethod?: string;
  brewhouse?: string;
  waterSource?: string;
  waterProfile?: string;
  batchVolumeTargetGallons?: number;
  volumeIntoFermenterGallons?: number;
  strikeWaterGallons?: number;
  spargeWaterGallons?: number;
  strikeTempTargetF?: number;
  strikeTempActualF?: number;
  mashTempTargetF?: number;
  mashTempActualF?: number;
  mashPh?: number;
  preBoilVolumeTargetGallons?: number;
  preBoilVolumeActualGallons?: number;
  preBoilGravityTarget?: number;
  preBoilGravityActual?: number;
  boilMinutesPlanned?: number;
  boilMinutesActual?: number;
  whirlpoolMinutes?: number;
  chillMinutes?: number;
  originalGravityTarget?: number;
  originalGravityActual?: number;
  pitchTempF?: number;
  fermentationTempLowF?: number;
  fermentationTempHighF?: number;
  yeastName?: string;
  yeastStarter?: string;
  notes?: string;
  checklist?: Partial<BrewDayChecklist>;
};

const BREWING_KEYWORDS = /(beer-brewing|brewing|homebrew|brew day|wort|mash|lager|ale|ferment)/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return undefined;
};

const coerceNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const match = value.match(/-?\d+(?:\.\d+)?/);
      if (!match) {
        continue;
      }

      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const coerceBoolean = (...values: unknown[]): boolean | undefined => {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value === "true") {
        return true;
      }

      if (value === "false") {
        return false;
      }
    }
  }

  return undefined;
};

const pickRecord = (...values: unknown[]): Record<string, unknown> => {
  for (const value of values) {
    if (isRecord(value)) {
      return value;
    }
  }

  return {};
};

const normalizeChecklist = (value: unknown): Partial<BrewDayChecklist> | undefined => {
  const record = pickRecord(value);
  const checklist: Partial<BrewDayChecklist> = {};

  const equipmentReady = coerceBoolean(record.equipmentReady);
  if (equipmentReady !== undefined) checklist.equipmentReady = equipmentReady;

  const waterAdjusted = coerceBoolean(record.waterAdjusted);
  if (waterAdjusted !== undefined) checklist.waterAdjusted = waterAdjusted;

  const fermenterSanitized = coerceBoolean(record.fermenterSanitized);
  if (fermenterSanitized !== undefined) checklist.fermenterSanitized = fermenterSanitized;

  const mashComplete = coerceBoolean(record.mashComplete);
  if (mashComplete !== undefined) checklist.mashComplete = mashComplete;

  const boilComplete = coerceBoolean(record.boilComplete);
  if (boilComplete !== undefined) checklist.boilComplete = boilComplete;

  const wortChilled = coerceBoolean(record.wortChilled);
  if (wortChilled !== undefined) checklist.wortChilled = wortChilled;

  const yeastPitched = coerceBoolean(record.yeastPitched);
  if (yeastPitched !== undefined) checklist.yeastPitched = yeastPitched;

  const cleanupComplete = coerceBoolean(record.cleanupComplete);
  if (cleanupComplete !== undefined) checklist.cleanupComplete = cleanupComplete;

  return Object.values(checklist).some((entry) => entry !== undefined) ? checklist : undefined;
};

const average = (...values: Array<number | undefined>): number | undefined => {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  if (valid.length === 0) {
    return undefined;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const pruneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const next = value
      .map((entry) => pruneValue(entry))
      .filter((entry) => entry !== undefined);
    return next.length > 0 ? next : undefined;
  }

  if (isRecord(value)) {
    const next = Object.entries(value).reduce<Record<string, unknown>>((result, [key, entry]) => {
      const pruned = pruneValue(entry);
      if (pruned !== undefined) {
        result[key] = pruned;
      }
      return result;
    }, {});

    return Object.keys(next).length > 0 ? next : undefined;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
};

export function isBeerBrewingHobby(hobby: Pick<BrewingHobbyLike, "hobbyType" | "name" | "description">): boolean {
  if (hobby.hobbyType === "beer-brewing") {
    return true;
  }

  const haystack = [hobby.hobbyType, hobby.name, hobby.description].filter(Boolean).join(" ");
  return BREWING_KEYWORDS.test(haystack);
}

export function resolveBrewDayData(
  customFields: Record<string, unknown>,
  hobby?: BrewingHobbyLike,
): BrewDayData {
  const hobbyDefaults = pickRecord(hobby?.customFields);
  const brewDay = pickRecord(customFields.brewDay);
  const fermTempLow = coerceNumber(brewDay.fermentationTempLowF, customFields.fermTempLow);
  const fermTempHigh = coerceNumber(brewDay.fermentationTempHighF, customFields.fermTempHigh);

  const next: BrewDayData = {};

  const brewingMethod = coerceString(brewDay.brewingMethod, customFields.brewingMethod, hobbyDefaults.brewingMethod);
  if (brewingMethod !== undefined) next.brewingMethod = brewingMethod;

  const brewhouse = coerceString(brewDay.brewhouse, customFields.brewhouse, hobbyDefaults.brewhouse);
  if (brewhouse !== undefined) next.brewhouse = brewhouse;

  const waterSource = coerceString(brewDay.waterSource, customFields.waterSource, hobbyDefaults.waterSource);
  if (waterSource !== undefined) next.waterSource = waterSource;

  const waterProfile = coerceString(brewDay.waterProfile, customFields.waterProfile);
  if (waterProfile !== undefined) next.waterProfile = waterProfile;

  const batchVolumeTargetGallons = coerceNumber(
    brewDay.batchVolumeTargetGallons,
    customFields.batchVolumeTargetGallons,
    customFields.defaultBatchSize,
    hobbyDefaults.defaultBatchSize,
  );
  if (batchVolumeTargetGallons !== undefined) next.batchVolumeTargetGallons = batchVolumeTargetGallons;

  const volumeIntoFermenterGallons = coerceNumber(brewDay.volumeIntoFermenterGallons, customFields.batchVolume);
  if (volumeIntoFermenterGallons !== undefined) next.volumeIntoFermenterGallons = volumeIntoFermenterGallons;

  const strikeWaterGallons = coerceNumber(brewDay.strikeWaterGallons);
  if (strikeWaterGallons !== undefined) next.strikeWaterGallons = strikeWaterGallons;

  const spargeWaterGallons = coerceNumber(brewDay.spargeWaterGallons);
  if (spargeWaterGallons !== undefined) next.spargeWaterGallons = spargeWaterGallons;

  const strikeTempTargetF = coerceNumber(brewDay.strikeTempTargetF);
  if (strikeTempTargetF !== undefined) next.strikeTempTargetF = strikeTempTargetF;

  const strikeTempActualF = coerceNumber(brewDay.strikeTempActualF);
  if (strikeTempActualF !== undefined) next.strikeTempActualF = strikeTempActualF;

  const mashTempTargetF = coerceNumber(brewDay.mashTempTargetF, customFields.mashTemp);
  if (mashTempTargetF !== undefined) next.mashTempTargetF = mashTempTargetF;

  const mashTempActualF = coerceNumber(brewDay.mashTempActualF);
  if (mashTempActualF !== undefined) next.mashTempActualF = mashTempActualF;

  const mashPh = coerceNumber(brewDay.mashPh);
  if (mashPh !== undefined) next.mashPh = mashPh;

  const preBoilVolumeTargetGallons = coerceNumber(brewDay.preBoilVolumeTargetGallons);
  if (preBoilVolumeTargetGallons !== undefined) next.preBoilVolumeTargetGallons = preBoilVolumeTargetGallons;

  const preBoilVolumeActualGallons = coerceNumber(brewDay.preBoilVolumeActualGallons);
  if (preBoilVolumeActualGallons !== undefined) next.preBoilVolumeActualGallons = preBoilVolumeActualGallons;

  const preBoilGravityTarget = coerceNumber(brewDay.preBoilGravityTarget);
  if (preBoilGravityTarget !== undefined) next.preBoilGravityTarget = preBoilGravityTarget;

  const preBoilGravityActual = coerceNumber(brewDay.preBoilGravityActual);
  if (preBoilGravityActual !== undefined) next.preBoilGravityActual = preBoilGravityActual;

  const boilMinutesPlanned = coerceNumber(brewDay.boilMinutesPlanned, customFields.boilDuration);
  if (boilMinutesPlanned !== undefined) next.boilMinutesPlanned = boilMinutesPlanned;

  const boilMinutesActual = coerceNumber(brewDay.boilMinutesActual);
  if (boilMinutesActual !== undefined) next.boilMinutesActual = boilMinutesActual;

  const whirlpoolMinutes = coerceNumber(brewDay.whirlpoolMinutes);
  if (whirlpoolMinutes !== undefined) next.whirlpoolMinutes = whirlpoolMinutes;

  const chillMinutes = coerceNumber(brewDay.chillMinutes);
  if (chillMinutes !== undefined) next.chillMinutes = chillMinutes;

  const originalGravityTarget = coerceNumber(brewDay.originalGravityTarget, customFields.targetOG);
  if (originalGravityTarget !== undefined) next.originalGravityTarget = originalGravityTarget;

  const originalGravityActual = coerceNumber(brewDay.originalGravityActual);
  if (originalGravityActual !== undefined) next.originalGravityActual = originalGravityActual;

  const pitchTempF = coerceNumber(brewDay.pitchTempF);
  if (pitchTempF !== undefined) next.pitchTempF = pitchTempF;

  if (fermTempLow !== undefined) next.fermentationTempLowF = fermTempLow;
  if (fermTempHigh !== undefined) next.fermentationTempHighF = fermTempHigh;

  const yeastName = coerceString(brewDay.yeastName);
  if (yeastName !== undefined) next.yeastName = yeastName;

  const yeastStarter = coerceString(brewDay.yeastStarter);
  if (yeastStarter !== undefined) next.yeastStarter = yeastStarter;

  const notes = coerceString(brewDay.notes);
  if (notes !== undefined) next.notes = notes;

  const checklist = normalizeChecklist(brewDay.checklist);
  if (checklist !== undefined) next.checklist = checklist;

  return next;
}

export function mergeBrewDayCustomFields(
  customFields: Record<string, unknown>,
  brewDayData: BrewDayData,
): Record<string, unknown> {
  const nextCustomFields = { ...customFields };
  const pruned = pruneValue({
    ...brewDayData,
    checklist: brewDayData.checklist,
  });

  if (pruned && isRecord(pruned)) {
    nextCustomFields.brewDay = pruned;
  } else {
    delete nextCustomFields.brewDay;
  }

  return nextCustomFields;
}

export function getBrewDayHighlights(brewDay: BrewDayData): string[] {
  const highlights = [
    brewDay.mashTempActualF != null ? `Mash ${brewDay.mashTempActualF}F` : null,
    brewDay.preBoilGravityActual != null ? `Pre-boil ${brewDay.preBoilGravityActual.toFixed(3)}` : null,
    brewDay.originalGravityActual != null ? `OG ${brewDay.originalGravityActual.toFixed(3)}` : null,
    brewDay.pitchTempF != null ? `Pitch ${brewDay.pitchTempF}F` : null,
    brewDay.volumeIntoFermenterGallons != null ? `Into fermenter ${brewDay.volumeIntoFermenterGallons} gal` : null,
    brewDay.chillMinutes != null ? `Chilled in ${brewDay.chillMinutes} min` : null,
  ].filter((entry): entry is string => entry != null);

  return highlights.slice(0, 4);
}

export function getBrewDayMissingItems(brewDay: BrewDayData): string[] {
  const missing: string[] = [];

  if (brewDay.batchVolumeTargetGallons == null) missing.push("target batch volume");
  if (brewDay.strikeWaterGallons == null) missing.push("strike water plan");
  if (brewDay.mashTempActualF == null) missing.push("actual mash temperature");
  if (brewDay.mashPh == null) missing.push("mash pH");
  if (brewDay.preBoilVolumeActualGallons == null) missing.push("actual pre-boil volume");
  if (brewDay.preBoilGravityActual == null) missing.push("actual pre-boil gravity");
  if (brewDay.originalGravityActual == null) missing.push("actual original gravity");
  if (brewDay.pitchTempF == null) missing.push("pitch temperature");
  if (brewDay.volumeIntoFermenterGallons == null) missing.push("volume into fermenter");
  if (brewDay.fermentationTempLowF == null && brewDay.fermentationTempHighF == null) missing.push("fermentation range");
  if (!brewDay.checklist?.fermenterSanitized) missing.push("sanitized fermenter confirmation");
  if (!brewDay.checklist?.yeastPitched) missing.push("yeast pitch confirmation");
  if (!brewDay.checklist?.cleanupComplete) missing.push("post-brew cleanup");

  return missing;
}

export function getBrewDayReadinessLabel(brewDay: BrewDayData): string {
  const checklist = brewDay.checklist;
  const completedItems = [
    checklist?.equipmentReady,
    checklist?.waterAdjusted,
    checklist?.fermenterSanitized,
    checklist?.mashComplete,
    checklist?.boilComplete,
    checklist?.wortChilled,
    checklist?.yeastPitched,
    checklist?.cleanupComplete,
  ].filter(Boolean).length;

  if (completedItems >= 8 && getBrewDayMissingItems(brewDay).length === 0) {
    return "Brew day captured";
  }

  if (completedItems >= 4) {
    return "Brew day underway";
  }

  return "Brew day details needed";
}

export function getRecommendedPitchTemperature(brewDay: BrewDayData): number | undefined {
  return average(brewDay.fermentationTempLowF, brewDay.fermentationTempHighF);
}