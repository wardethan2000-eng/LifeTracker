import type {
  LibraryPreset,
  NotificationConfig,
  PresetCustomFieldTemplate,
  PresetScheduleTemplate,
  PresetUsageMetricTemplate
} from "@lifekeeper/types";

const field = (
  input: Omit<PresetCustomFieldTemplate, "required" | "options" | "wide" | "order"> & Partial<Pick<PresetCustomFieldTemplate, "required" | "options" | "wide" | "order">>
): PresetCustomFieldTemplate => ({
  required: false,
  options: [],
  wide: false,
  order: 0,
  ...input
});

const metric = (
  input: Omit<PresetUsageMetricTemplate, "allowManualEntry"> & Partial<Pick<PresetUsageMetricTemplate, "allowManualEntry">>
): PresetUsageMetricTemplate => ({
  allowManualEntry: true,
  ...input
});

const notification = (overrides: Partial<NotificationConfig> = {}): NotificationConfig => ({
  channels: overrides.channels ? [...overrides.channels] : ["push"],
  sendAtDue: true,
  digest: false,
  ...overrides
});

const schedule = (
  input: Omit<PresetScheduleTemplate, "notificationConfig" | "tags"> & Partial<Pick<PresetScheduleTemplate, "notificationConfig" | "tags">>
): PresetScheduleTemplate => {
  const notificationConfig = input.notificationConfig ? notification(input.notificationConfig) : notification();
  const tags = input.tags ? [...input.tags] : [];

  return {
    ...input,
    notificationConfig,
    tags
  };
};

const libraryPreset = (input: Omit<LibraryPreset, "source">): LibraryPreset => ({
  source: "library",
  ...input,
  tags: [...input.tags],
  suggestedCustomFields: [...input.suggestedCustomFields],
  metricTemplates: [...input.metricTemplates],
  scheduleTemplates: [...input.scheduleTemplates]
});

const standardPushDigest = notification({
  channels: ["push", "digest"],
  digest: true,
  overdueCadenceDays: 14,
  maxOverdueNotifications: 4
});

export const presetLibrary = [
  libraryPreset({
    key: "vehicle-core-care",
    label: "Vehicle Core Care",
    category: "vehicle",
    description: "A broad vehicle maintenance profile focused on fluids, filters, tires, inspections, and annual ownership tasks rather than any specific make or model.",
    tags: ["vehicle", "car", "truck", "ownership"],
    suggestedCustomFields: [
      field({ key: "year", label: "Year", type: "number" }),
      field({ key: "make", label: "Make", type: "string" }),
      field({ key: "model", label: "Model", type: "string" }),
      field({ key: "trim", label: "Trim", type: "string" }),
      field({ key: "vin", label: "VIN", type: "string" }),
      field({ key: "licensePlate", label: "License Plate", type: "string" }),
      field({ key: "fuelType", label: "Fuel Type", type: "select", options: ["gasoline", "diesel", "hybrid", "electric", "other"] }),
      field({ key: "driveType", label: "Drive Type", type: "select", options: ["FWD", "RWD", "AWD", "4WD", "other"] }),
      field({ key: "tireSize", label: "Tire Size", type: "string" }),
      field({ key: "oilType", label: "Preferred Oil Type", type: "string" })
    ],
    metricTemplates: [
      metric({ key: "odometer", name: "Odometer", unit: "miles", startingValue: 0 }),
      metric({ key: "engine_hours", name: "Engine Hours", unit: "hours", startingValue: 0 })
    ],
    scheduleTemplates: [
      schedule({ key: "engine_oil", name: "Engine oil and filter", description: "Core recurring fluid and filter service.", triggerTemplate: { type: "compound", intervalDays: 180, metricKey: "odometer", intervalValue: 5000, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 250 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 250 }), tags: ["oil", "engine", "fluids"], quickLogLabel: "Oil changed" }),
      schedule({ key: "tire_rotation", name: "Tire rotation", triggerTemplate: { type: "usage", metricKey: "odometer", intervalValue: 7500, leadTimeValue: 500 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 500 }), tags: ["tires"] }),
      schedule({ key: "engine_air_filter", name: "Engine air filter", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["filters"] }),
      schedule({ key: "cabin_air_filter", name: "Cabin air filter", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["filters", "comfort"] }),
      schedule({ key: "brake_fluid", name: "Brake fluid service", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["brakes", "fluids"] }),
      schedule({ key: "coolant_service", name: "Coolant inspection and service", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["cooling", "fluids"] }),
      schedule({ key: "transmission_service", name: "Transmission service", triggerTemplate: { type: "usage", metricKey: "odometer", intervalValue: 30000, leadTimeValue: 2000 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 2000, overdueCadenceDays: 30 }), tags: ["drivetrain", "fluids"] }),
      schedule({ key: "battery_check", name: "Battery and terminal check", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["electrical"] }),
      schedule({ key: "registration_renewal", name: "Registration or tags renewal", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["legal", "ownership"] }),
      schedule({ key: "inspection", name: "Inspection or emissions", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["legal", "safety"] })
    ]
  }),
  libraryPreset({
    key: "home-essential-systems",
    label: "Home Essential Systems",
    category: "home",
    description: "A broad home-maintenance profile covering filters, safety items, water systems, vents, weatherproofing, and seasonal checks.",
    tags: ["home", "seasonal", "safety"],
    suggestedCustomFields: [
      field({ key: "address", label: "Address", type: "string" }),
      field({ key: "yearBuilt", label: "Year Built", type: "number" }),
      field({ key: "squareFootage", label: "Square Footage", type: "number" }),
      field({ key: "hvacFilterSize", label: "HVAC Filter Size", type: "string" }),
      field({ key: "waterHeaterType", label: "Water Heater Type", type: "select", options: ["tank", "tankless", "hybrid", "other"] }),
      field({ key: "roofMaterial", label: "Roof Material", type: "string" }),
      field({ key: "hasSumpPump", label: "Has Sump Pump", type: "boolean", defaultValue: false }),
      field({ key: "hasSmokeDetectors", label: "Has Smoke Detectors", type: "boolean", defaultValue: true }),
      field({ key: "hasRefrigeratorFilter", label: "Refrigerator Water Filter", type: "boolean", defaultValue: true }),
      field({ key: "notes", label: "Owner Notes", type: "textarea" })
    ],
    metricTemplates: [],
    scheduleTemplates: [
      schedule({ key: "hvac_filter", name: "Replace HVAC filter", triggerTemplate: { type: "interval", intervalDays: 90, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7 }), tags: ["filters", "hvac"] }),
      schedule({ key: "smoke_detector_batteries", name: "Replace smoke detector batteries", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 14, maxOverdueNotifications: 6 }), tags: ["safety"] }),
      schedule({ key: "fire_extinguisher_check", name: "Inspect fire extinguishers", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["safety"] }),
      schedule({ key: "water_heater_flush", name: "Flush water heater", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["water", "plumbing"] }),
      schedule({ key: "dryer_vent", name: "Clean dryer vent", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["laundry", "safety"] }),
      schedule({ key: "gutter_cleaning", name: "Clean gutters and downspouts", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["exterior", "roof"] }),
      schedule({ key: "gfci_test", name: "Test GFCI outlets", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["electrical", "safety"] }),
      schedule({ key: "sump_pump_test", name: "Test sump pump", triggerTemplate: { type: "interval", intervalDays: 90, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7 }), tags: ["water", "basement"] }),
      schedule({ key: "refrigerator_filter", name: "Replace refrigerator water filter", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["kitchen", "filters"] }),
      schedule({ key: "winterize_faucets", name: "Winterize exterior faucets", triggerTemplate: { type: "seasonal", month: 10, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 14, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["seasonal", "plumbing"] })
    ]
  }),
  libraryPreset({
    key: "marine-vessel-seasonal-care",
    label: "Marine Vessel Seasonal Care",
    category: "marine",
    description: "A general-purpose boat and trailer profile with engine-hour service, winterization, safety equipment, and seasonal launch prep.",
    tags: ["marine", "boat", "seasonal"],
    suggestedCustomFields: [
      field({ key: "hullId", label: "Hull ID", type: "string" }),
      field({ key: "lengthFeet", label: "Length (ft)", type: "number" }),
      field({ key: "engineType", label: "Engine Type", type: "string" }),
      field({ key: "fuelType", label: "Fuel Type", type: "string" }),
      field({ key: "storageLocation", label: "Storage Location", type: "string" }),
      field({ key: "hasTrailer", label: "Stored on Trailer", type: "boolean", defaultValue: true })
    ],
    metricTemplates: [
      metric({ key: "engine_hours", name: "Engine Hours", unit: "hours", startingValue: 0 })
    ],
    scheduleTemplates: [
      schedule({ key: "engine_oil", name: "Engine oil and filter", triggerTemplate: { type: "compound", intervalDays: 365, metricKey: "engine_hours", intervalValue: 100, logic: "whichever_first", leadTimeDays: 21, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21, upcomingLeadValue: 10 }), tags: ["engine", "fluids"] }),
      schedule({ key: "fuel_separator", name: "Replace fuel water separator", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["fuel", "filters"] }),
      schedule({ key: "impeller", name: "Inspect or replace impeller", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["cooling"] }),
      schedule({ key: "safety_kit", name: "Inspect safety kit and life jackets", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 6 }), tags: ["safety"] }),
      schedule({ key: "trailer_bearings", name: "Service trailer bearings", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["trailer"] }),
      schedule({ key: "winterize", name: "Winterize vessel", triggerTemplate: { type: "seasonal", month: 10, day: 1, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["seasonal"] }),
      schedule({ key: "dewinterize", name: "Launch prep and de-winterize", triggerTemplate: { type: "seasonal", month: 4, day: 1, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["seasonal"] })
    ]
  }),
  libraryPreset({
    key: "yard-equipment-runtime-care",
    label: "Yard Equipment Runtime Care",
    category: "yard",
    description: "A profile for mowers, snow blowers, generators, and similar outdoor equipment with runtime-based service and off-season reminders.",
    tags: ["yard", "equipment", "seasonal"],
    suggestedCustomFields: [
      field({ key: "equipmentType", label: "Equipment Type", type: "select", options: ["mower", "snow blower", "generator", "trimmer", "other"] }),
      field({ key: "brand", label: "Brand", type: "string" }),
      field({ key: "model", label: "Model", type: "string" }),
      field({ key: "powerType", label: "Power Type", type: "select", options: ["gas", "battery", "electric", "diesel", "other"] }),
      field({ key: "bladeSize", label: "Blade or Deck Size", type: "string" }),
      field({ key: "fuelMix", label: "Fuel Mix", type: "string" })
    ],
    metricTemplates: [
      metric({ key: "runtime_hours", name: "Runtime Hours", unit: "hours", startingValue: 0 })
    ],
    scheduleTemplates: [
      schedule({ key: "oil_change", name: "Oil change", triggerTemplate: { type: "compound", intervalDays: 180, metricKey: "runtime_hours", intervalValue: 50, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 5 }), tags: ["engine", "fluids"] }),
      schedule({ key: "air_filter", name: "Clean or replace air filter", triggerTemplate: { type: "usage", metricKey: "runtime_hours", intervalValue: 50, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 5 }), tags: ["filters"] }),
      schedule({ key: "spark_plug", name: "Inspect spark plug", triggerTemplate: { type: "compound", intervalDays: 365, metricKey: "runtime_hours", intervalValue: 100, logic: "whichever_first", leadTimeDays: 21, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21, upcomingLeadValue: 10 }), tags: ["ignition"] }),
      schedule({ key: "blade_service", name: "Sharpen or replace blades", triggerTemplate: { type: "usage", metricKey: "runtime_hours", intervalValue: 25, leadTimeValue: 3 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 3 }), tags: ["cutting"] }),
      schedule({ key: "battery_service", name: "Battery maintenance", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["electrical"] }),
      schedule({ key: "fuel_stabilizer", name: "Add fuel stabilizer or drain fuel", triggerTemplate: { type: "seasonal", month: 10, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 14, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["seasonal", "fuel"] })
    ]
  }),
  libraryPreset({
    key: "hvac-system-management",
    label: "HVAC System Management",
    category: "hvac",
    description: "A system-level preset for central HVAC equipment with filters, condensate, seasonal tune-ups, humidifier care, and battery reminders.",
    tags: ["hvac", "filters", "seasonal"],
    suggestedCustomFields: [
      field({ key: "systemType", label: "System Type", type: "select", options: ["furnace", "heat pump", "air conditioner", "mini split", "boiler", "other"] }),
      field({ key: "filterSize", label: "Filter Size", type: "string" }),
      field({ key: "thermostatModel", label: "Thermostat Model", type: "string" }),
      field({ key: "humidifierPresent", label: "Humidifier Installed", type: "boolean", defaultValue: false }),
      field({ key: "installer", label: "Installer or Service Company", type: "string" })
    ],
    metricTemplates: [],
    scheduleTemplates: [
      schedule({ key: "filter_replace", name: "Replace HVAC filter", triggerTemplate: { type: "interval", intervalDays: 90, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7 }), tags: ["filters"] }),
      schedule({ key: "condensate_flush", name: "Flush condensate line", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["cooling"] }),
      schedule({ key: "spring_service", name: "Spring cooling tune-up", triggerTemplate: { type: "seasonal", month: 4, day: 1, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["seasonal", "service"] }),
      schedule({ key: "fall_service", name: "Fall heating tune-up", triggerTemplate: { type: "seasonal", month: 10, day: 1, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["seasonal", "service"] }),
      schedule({ key: "humidifier_pad", name: "Replace humidifier pad", triggerTemplate: { type: "seasonal", month: 10, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["humidity"] }),
      schedule({ key: "thermostat_battery", name: "Replace thermostat batteries", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["electrical"] })
    ]
  }),
  libraryPreset({
    key: "workshop-fabrication-equipment",
    label: "Workshop Fabrication Equipment",
    category: "workshop",
    description: "A general maintenance profile for fabrication tools, shop machines, and precision equipment with cleaning, lubrication, wear items, and calibration tasks.",
    tags: ["workshop", "tools", "fabrication"],
    suggestedCustomFields: [
      field({ key: "machineType", label: "Machine Type", type: "select", options: ["3d printer", "lathe", "mill", "table saw", "dust collector", "other"] }),
      field({ key: "brand", label: "Brand", type: "string" }),
      field({ key: "model", label: "Model", type: "string" }),
      field({ key: "serialNumber", label: "Serial Number", type: "string" }),
      field({ key: "lubricationType", label: "Lubrication Type", type: "string" }),
      field({ key: "consumables", label: "Consumables", type: "multiselect", options: ["belts", "filters", "nozzles", "blades", "bearings", "other"] })
    ],
    metricTemplates: [
      metric({ key: "runtime_hours", name: "Runtime Hours", unit: "hours", startingValue: 0 })
    ],
    scheduleTemplates: [
      schedule({ key: "cleaning", name: "Clean debris and dust", triggerTemplate: { type: "compound", intervalDays: 30, metricKey: "runtime_hours", intervalValue: 30, logic: "whichever_first", leadTimeDays: 5, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 5, upcomingLeadValue: 5 }), tags: ["cleaning"] }),
      schedule({ key: "lubrication", name: "Lubricate moving assemblies", triggerTemplate: { type: "compound", intervalDays: 90, metricKey: "runtime_hours", intervalValue: 50, logic: "whichever_first", leadTimeDays: 7, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7, upcomingLeadValue: 5 }), tags: ["lubrication"] }),
      schedule({ key: "belts", name: "Inspect belts and tension", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["wear items"] }),
      schedule({ key: "calibration", name: "Check calibration and alignment", triggerTemplate: { type: "interval", intervalDays: 60, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7 }), tags: ["precision"] }),
      schedule({ key: "consumables", name: "Inspect consumables and replace wear parts", triggerTemplate: { type: "usage", metricKey: "runtime_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["consumables"] }),
      schedule({ key: "firmware_backup", name: "Backup settings or firmware configuration", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["configuration"] })
    ]
  })
] as const;