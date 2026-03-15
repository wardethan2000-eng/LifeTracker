import type {
  HobbyPreset,
  HobbyPresetMetricTemplate,
  HobbyPresetPipelineStep,
  HobbyPresetRecipeField,
} from "@lifekeeper/types";

const hobbyPreset = (input: HobbyPreset): HobbyPreset => ({ ...input });

const hobbyMetric = (
  input: Omit<HobbyPresetMetricTemplate, "metricType"> & Partial<Pick<HobbyPresetMetricTemplate, "metricType">>
): HobbyPresetMetricTemplate => ({ metricType: "numeric", ...input });

const pipelineStep = (
  label: string,
  sortOrder: number,
  options?: { color?: string; isFinal?: boolean }
): HobbyPresetPipelineStep => ({
  label,
  sortOrder,
  ...(options?.color ? { color: options.color } : {}),
  isFinal: options?.isFinal ?? false,
});

const recipeField = (
  input: Omit<HobbyPresetRecipeField, "options"> & Partial<Pick<HobbyPresetRecipeField, "options">>
): HobbyPresetRecipeField => ({ options: [], ...input });

export const hobbyPresetLibrary: HobbyPreset[] = [
  hobbyPreset({
    key: "beer-brewing",
    label: "Beer Brewing",
    description: "Homebrewing beer — all-grain, extract, or BIAB. Full pipeline from brew day through conditioning.",
    lifecycleMode: "pipeline",
    tags: ["brewing", "beer", "fermentation", "homebrewing"],

    suggestedCustomFields: [
      {
        key: "brewingMethod",
        label: "Brewing Method",
        type: "select",
        required: false,
        options: ["All-Grain", "Extract", "BIAB (Brew in a Bag)", "Partial Mash"],
        wide: false,
        order: 0,
      },
      {
        key: "defaultBatchSize",
        label: "Default Batch Size (gallons)",
        type: "number",
        required: false,
        options: [],
        wide: false,
        order: 1,
      },
      {
        key: "fermentationVesselType",
        label: "Fermentation Vessel Type",
        type: "select",
        required: false,
        options: ["Bucket", "Carboy", "Conical", "Unitank"],
        wide: false,
        order: 2,
      },
      {
        key: "carbonationMethod",
        label: "Carbonation Method",
        type: "select",
        required: false,
        options: ["Bottle Conditioning", "Forced (Keg)", "Natural"],
        wide: false,
        order: 3,
      },
      {
        key: "waterSource",
        label: "Water Source",
        type: "select",
        required: false,
        options: ["Municipal", "Well", "Spring", "RO/Distilled"],
        wide: false,
        order: 4,
      },
      {
        key: "brewhouse",
        label: "Brewhouse",
        type: "string",
        required: false,
        options: [],
        wide: false,
        order: 5,
      },
    ],

    pipelineSteps: [
      pipelineStep("Planned", 0, { color: "gray" }),
      pipelineStep("Brew Day", 1, { color: "blue" }),
      pipelineStep("Primary Fermentation", 2, { color: "amber" }),
      pipelineStep("Secondary / Dry Hop", 3, { color: "amber" }),
      pipelineStep("Cold Crash / Clarification", 4, { color: "cyan" }),
      pipelineStep("Packaging", 5, { color: "green" }),
      pipelineStep("Conditioning / Carbonating", 6, { color: "green" }),
      pipelineStep("Ready / Aging", 7, { color: "teal" }),
      pipelineStep("Completed", 8, { color: "green", isFinal: true }),
    ],

    metricTemplates: [
      hobbyMetric({ key: "og", name: "Original Gravity (OG)", unit: "SG", metricType: "gravity" }),
      hobbyMetric({ key: "fg", name: "Final Gravity (FG)", unit: "SG", metricType: "gravity" }),
      hobbyMetric({ key: "ph", name: "pH", unit: "pH", metricType: "ph" }),
      hobbyMetric({ key: "fermentation-temp", name: "Fermentation Temperature", unit: "°F", metricType: "temperature" }),
      hobbyMetric({ key: "batch-volume", name: "Batch Volume", unit: "gal" }),
      hobbyMetric({ key: "pre-boil-gravity", name: "Pre-Boil Gravity", unit: "SG", metricType: "gravity" }),
      hobbyMetric({ key: "mash-temp", name: "Mash Temperature", unit: "°F", metricType: "temperature" }),
    ],

    inventoryCategories: [
      "Base Malts",
      "Specialty Malts",
      "Hops",
      "Yeast",
      "Adjuncts & Sugars",
      "Water Chemistry",
      "Fining Agents",
      "Priming Sugar",
      "Sanitizer & Cleaning",
      "Bottling / Kegging Supplies",
    ],

    recipeFields: [
      recipeField({ key: "bjcpStyle", label: "BJCP Style", type: "string", helpText: "e.g. 10A - American Pale Ale", group: "Style" }),
      recipeField({ key: "targetOG", label: "Target OG", type: "number", unit: "SG", group: "Targets" }),
      recipeField({ key: "targetFG", label: "Target FG", type: "number", unit: "SG", group: "Targets" }),
      recipeField({ key: "targetABV", label: "Target ABV", type: "number", unit: "%", group: "Targets" }),
      recipeField({ key: "targetIBU", label: "Target IBU", type: "number", unit: "IBU", group: "Targets" }),
      recipeField({ key: "targetSRM", label: "Target SRM", type: "number", unit: "SRM", group: "Targets" }),
      recipeField({ key: "mashTemp", label: "Mash Temperature", type: "number", unit: "°F", group: "Process" }),
      recipeField({ key: "mashDuration", label: "Mash Duration", type: "number", unit: "min", group: "Process" }),
      recipeField({ key: "boilDuration", label: "Boil Duration", type: "number", unit: "min", group: "Process" }),
      recipeField({ key: "fermTempLow", label: "Ferm Temp Low", type: "number", unit: "°F", group: "Process" }),
      recipeField({ key: "fermTempHigh", label: "Ferm Temp High", type: "number", unit: "°F", group: "Process" }),
      recipeField({ key: "carbonationLevel", label: "Carbonation Level", type: "number", unit: "volumes CO2", group: "Packaging" }),
      recipeField({ key: "waterProfile", label: "Water Profile", type: "string", helpText: "Target water chemistry or style (e.g., Burton, Pilsen)", group: "Water" }),
    ],

    suggestedEquipment: [
      "Brew Kettle",
      "Mash Tun",
      "Hot Liquor Tank",
      "Fermenter (Primary)",
      "Fermenter (Secondary)",
      "Keg System",
      "Bottle Filler / Capper",
      "Wort Chiller",
      "Temperature Controller",
      "Hydrometer / Refractometer",
      "pH Meter",
      "Grain Mill",
      "Auto-Siphon / Transfer Pump",
      "CO2 Tank & Regulator",
      "Cleaning Bucket / Spray",
    ],

    sessionStepTypes: [
      "mash",
      "boil",
      "chill",
      "pitch",
      "ferment",
      "dry-hop",
      "cold-crash",
      "package",
      "condition",
    ],

    starterRecipes: [
      {
        name: "Simple American Pale Ale",
        description: "A straightforward APA — clean malt backbone, citrusy American hops, and a crisp finish.",
        styleCategory: "10A - American Pale Ale",
        ingredients: [
          { name: "Pale Malt (2-Row)", quantity: 9, unit: "lb", category: "Base Malts" },
          { name: "Crystal 40L", quantity: 1, unit: "lb", category: "Specialty Malts" },
          { name: "Munich Malt", quantity: 0.5, unit: "lb", category: "Specialty Malts" },
          { name: "Cascade (60 min)", quantity: 1, unit: "oz", category: "Hops" },
          { name: "Cascade (15 min)", quantity: 1, unit: "oz", category: "Hops" },
          { name: "Cascade (0 min / flameout)", quantity: 1, unit: "oz", category: "Hops" },
          { name: "US-05 / Safale American Ale Yeast", quantity: 1, unit: "packet", category: "Yeast" },
          { name: "Irish Moss (15 min)", quantity: 1, unit: "tsp", category: "Fining Agents" },
          { name: "Priming Sugar (if bottling)", quantity: 5, unit: "oz", category: "Priming Sugar" },
        ],
        steps: [
          { title: "Heat Strike Water", description: "Heat 4 gallons to 164°F for a target mash temp of 152°F.", stepType: "mash", durationMinutes: 15 },
          { title: "Mash In", description: "Add grain to strike water, stir to eliminate dough balls. Hold at 152°F.", stepType: "mash", durationMinutes: 60 },
          { title: "Mash Out", description: "Raise to 168°F and hold for 10 minutes to halt enzymatic activity.", stepType: "mash", durationMinutes: 10 },
          { title: "Sparge", description: "Batch sparge or fly sparge with 170°F water to collect ~6.5 gallons.", stepType: "mash", durationMinutes: 20 },
          { title: "Bring to Boil", description: "Bring wort to a rolling boil. Watch for hot break.", stepType: "boil", durationMinutes: 10 },
          { title: "60-Minute Hop Addition", description: "Add 1 oz Cascade. Start 60-minute boil timer.", stepType: "boil", durationMinutes: 45 },
          { title: "15-Minute Additions", description: "Add 1 oz Cascade and 1 tsp Irish Moss with 15 minutes remaining.", stepType: "boil", durationMinutes: 15 },
          { title: "Flameout Hops", description: "Kill heat. Add 1 oz Cascade at flameout. Steep 10 minutes.", stepType: "boil", durationMinutes: 10 },
          { title: "Chill Wort", description: "Chill to 66°F as quickly as possible using wort chiller.", stepType: "chill", durationMinutes: 20 },
          { title: "Transfer & Pitch Yeast", description: "Transfer to fermenter, leaving trub behind. Aerate well. Pitch yeast.", stepType: "pitch", durationMinutes: 15 },
          { title: "Primary Fermentation", description: "Ferment at 64–68°F for 10–14 days until activity slows and gravity is stable.", stepType: "ferment" },
          { title: "Package", description: "Bottle with priming sugar or keg and force carbonate to 2.4 volumes CO2.", stepType: "package", durationMinutes: 30 },
          { title: "Condition", description: "Bottle condition 2 weeks at room temp, or keg condition 3–5 days cold.", stepType: "condition" },
        ],
        customFields: {
          bjcpStyle: "10A - American Pale Ale",
          targetOG: 1.052,
          targetFG: 1.012,
          targetABV: 5.2,
          targetIBU: 40,
          targetSRM: 7,
          mashTemp: 152,
          mashDuration: 60,
          boilDuration: 60,
          fermTempLow: 64,
          fermTempHigh: 68,
          carbonationLevel: 2.4,
          waterProfile: "Balanced",
        },
      },
    ],
  }),
];
