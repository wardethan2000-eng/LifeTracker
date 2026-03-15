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

const aircraftGroundingNotification = (upcomingLeadDays: number): NotificationConfig => notification({
  channels: ["push", "email", "digest"],
  digest: true,
  upcomingLeadDays,
  overdueCadenceDays: 7,
  maxOverdueNotifications: 8
});

const aircraftPlanningNotification = (upcomingLeadDays: number, upcomingLeadValue: number): NotificationConfig => notification({
  channels: ["push", "email", "digest"],
  digest: true,
  upcomingLeadDays,
  upcomingLeadValue,
  overdueCadenceDays: 14,
  maxOverdueNotifications: 6
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
    key: "aircraft-piston-single-engine",
    label: "Piston Single-Engine Airplane",
    category: "aircraft",
    description: "A comprehensive general-aviation profile for fixed-wing piston singles such as Cessna 172s, Piper Cherokees, and Beechcraft Bonanzas. Covers regulatory inspections, engine and propeller lifecycle tracking, airframe wear, avionics upkeep, and seasonal storage planning.",
    tags: ["aircraft", "aviation", "piston", "single engine", "fixed wing"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N12345", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 2 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Cessna", group: "Registration & Airframe", order: 3 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "172S Skyhawk", group: "Registration & Airframe", order: 4 }),
      field({ key: "engineMake", label: "Engine Manufacturer", type: "string", placeholder: "Lycoming", group: "Powerplant", order: 0 }),
      field({ key: "engineModel", label: "Engine Model", type: "string", placeholder: "IO-360-L2A", group: "Powerplant", order: 1 }),
      field({ key: "engineSerial", label: "Engine Serial Number", type: "string", group: "Powerplant", order: 2 }),
      field({ key: "engineTbo", label: "Engine TBO (hours)", type: "number", helpText: "Time Between Overhaul in tach hours per manufacturer recommendation. Typically 1,800-2,000 for most Lycoming/Continental engines.", group: "Powerplant", order: 3 }),
      field({ key: "engineTsmoh", label: "Engine TSMOH", type: "number", helpText: "Time Since Major Overhaul in tach hours. Enter current tach hours since last overhaul.", group: "Powerplant", order: 4 }),
      field({ key: "oilType", label: "Preferred Oil Type", type: "string", placeholder: "Aeroshell W100", group: "Powerplant", order: 5 }),
      field({ key: "propMake", label: "Propeller Manufacturer", type: "string", group: "Propeller & Gear", order: 0 }),
      field({ key: "propModel", label: "Propeller Model", type: "string", group: "Propeller & Gear", order: 1 }),
      field({ key: "propSerial", label: "Propeller Serial Number", type: "string", group: "Propeller & Gear", order: 2 }),
      field({ key: "propType", label: "Propeller Type", type: "select", options: ["fixed pitch", "constant speed"], group: "Propeller & Gear", order: 3 }),
      field({ key: "gearType", label: "Gear Type", type: "select", options: ["fixed tricycle", "fixed tailwheel", "retractable tricycle", "retractable tailwheel", "amphibious"], group: "Propeller & Gear", order: 4 }),
      field({ key: "fuelType", label: "Fuel Type", type: "select", options: ["100LL", "100VLL", "UL94", "autogas STC", "Jet-A", "other"], group: "Mission Systems", order: 0 }),
      field({ key: "airframeTime", label: "Total Airframe Time", type: "number", helpText: "Useful for correlating airframe wear, resale value, and maintenance history even when the main recurring schedules key off other metrics.", group: "Mission Systems", order: 1 }),
      field({ key: "numSeats", label: "Number of Seats", type: "number", group: "Mission Systems", order: 1 }),
      field({ key: "ifrCapable", label: "IFR Equipped", type: "boolean", defaultValue: false, helpText: "If yes, pitot-static and transponder certification checks are required for IFR flight.", group: "Mission Systems", order: 2 }),
      field({ key: "adsbOutCompliant", label: "ADS-B Out Equipped", type: "boolean", defaultValue: true, helpText: "Important for most controlled airspace operation, though not a recurring calendar inspection item by itself.", group: "Mission Systems", order: 3 }),
      field({ key: "engineMonitorInstalled", label: "Engine Monitor Installed", type: "boolean", defaultValue: false, group: "Mission Systems", order: 4 }),
      field({ key: "autopilotInstalled", label: "Autopilot Installed", type: "boolean", defaultValue: false, group: "Mission Systems", order: 5 }),
      field({ key: "homeAirport", label: "Home Airport", type: "string", placeholder: "KICT", group: "Operations & Support", order: 0 }),
      field({ key: "hangarOrTiedown", label: "Storage Type", type: "select", options: ["hangar", "tie-down", "T-hangar", "shared hangar"], group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "insuranceRenewal", label: "Insurance Renewal Month", type: "number", helpText: "Month number (1-12) when policy renews.", group: "Operations & Support", order: 3 }),
      field({ key: "mechanicName", label: "A&P / IA Mechanic or Shop", type: "string", helpText: "Your primary maintenance shop or IA (Inspection Authorization) mechanic.", group: "Operations & Support", order: 4 })
    ],
    metricTemplates: [
      metric({ key: "hobbs_hours", name: "Hobbs Hours", unit: "hours", startingValue: 0, helpText: "Total hobbs time. Updated after each flight from the hobbs meter. This is the general-purpose flight time metric." }),
      metric({ key: "tach_hours", name: "Tach Hours", unit: "hours", startingValue: 0, helpText: "Total tachometer time. Accumulates based on engine RPM. Used for engine TBO tracking. Tach hours are typically 10-20% less than hobbs hours." }),
      metric({ key: "landing_cycles", name: "Landing Cycles", unit: "landings", startingValue: 0, allowManualEntry: true, helpText: "Total number of landings. Relevant for tire, brake, and landing gear service intervals." })
    ],
    scheduleTemplates: [
      schedule({ key: "annual_inspection", name: "Annual Inspection (14 CFR 91.409)", description: "FAA-required annual inspection by an IA-certified mechanic. The aircraft is unairworthy if this lapses. Schedule well in advance; shops book up, and the inspection often reveals squawks that require parts and additional work.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "inspection", "annual"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification (14 CFR 91.413)", description: "Biennial transponder certification required for all transponder-equipped aircraft. Must be performed by a certified repair station.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check (14 CFR 91.411)", description: "Biennial pitot-static system and altimeter certification. Required for IFR flight. Often done alongside transponder check to save on shop visits.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection (14 CFR 91.207)", description: "Annual ELT inspection covering operation, battery condition, and mounting security. This is a grounding item if missed.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "elt_battery", name: "ELT Battery Replacement", description: "Replace the ELT battery on the stamped manufacturer interval and verify the date during annual inspection. Ordering ahead matters because many units use aircraft-specific packs.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "safety", "elt", "battery"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "FAA aircraft registration expires every 3 years. Start early so the renewal is complete before the paper certificate lapses.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "alternator_belt_inspection", name: "Alternator Belt and Charging Drive Inspection", description: "Inspect belt tension, glazing, cracking, and pulley alignment before a weak charging system strands you away from home or fails during IFR night operation.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["electrical", "engine", "inspection"] }),
      schedule({ key: "induction_filter_service", name: "Induction Air Filter Service", description: "Inspect and clean or replace the induction filter on a defined rhythm rather than waiting for obvious power loss or dusty evidence in the box.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["engine", "filters", "induction"] }),
      schedule({ key: "oil_change", name: "Engine Oil and Filter Change", description: "Most piston singles run oil and filter changes every 50 hobbs hours or 4 months. Oil sample tracking is strongly recommended with each change.", triggerTemplate: { type: "compound", intervalDays: 120, metricKey: "hobbs_hours", intervalValue: 50, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 5 }), tags: ["engine", "fluids", "oil"] }),
      schedule({ key: "oil_analysis", name: "Oil Analysis (Send Sample to Lab)", description: "Send a sample with each oil change so you can trend metals, silicon, and fuel dilution instead of reacting to a single report in isolation.", triggerTemplate: { type: "compound", intervalDays: 120, metricKey: "hobbs_hours", intervalValue: 50, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 5 }), tags: ["engine", "oil", "analysis"] }),
      schedule({ key: "spark_plug_service", name: "Spark Plug Cleaning and Rotation", description: "Clean, inspect, gap, and rotate plugs every 100 hours to keep fouling and uneven wear from sneaking up on you.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["engine", "ignition"] }),
      schedule({ key: "magneto_timing", name: "Magneto Inspection and Timing", description: "Inspect points, timing, and P-leads. Dual magnetos are a safety-critical redundancy system, not just another tune-up item.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 500, leadTimeValue: 50 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 50 }), tags: ["engine", "ignition", "magnetos"] }),
      schedule({ key: "engine_overhaul_tracking", name: "Engine TBO / Overhaul Planning", description: "Track the major overhaul horizon as both a tach-hour and calendar planning event. Even Part 91 owners need lead time for shop backlog, financing, and engine core decisions.", triggerTemplate: { type: "compound", intervalDays: 4380, metricKey: "tach_hours", intervalValue: 2000, logic: "whichever_first", leadTimeDays: 180, leadTimeValue: 200 }, notificationConfig: aircraftPlanningNotification(180, 200), tags: ["engine", "overhaul", "major"] }),
      schedule({ key: "compression_check", name: "Differential Compression Check", description: "Compression is usually checked at annual, but trending results independently helps separate normal wear from a developing cylinder problem.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["engine", "inspection", "cylinders"] }),
      schedule({ key: "exhaust_heat_muff_inspection", name: "Exhaust and Cabin Heat Muff Inspection", description: "Inspect mufflers, heat muffs, shrouds, and exhaust slip joints for cracking or leakage. Exhaust defects can become carbon-monoxide hazards quickly.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["engine", "safety", "exhaust"] }),
      schedule({ key: "vacuum_or_backup_instrument_service", name: "Vacuum System / Backup Attitude Source Review", description: "Many legacy piston singles depend on vacuum pumps or limited standby sources. Treat the backup attitude chain as a tracked reliability item, especially for IFR flying.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["avionics", "ifr", "safety"] }),
      schedule({ key: "engine_mount_inspection", name: "Engine Mount Inspection", description: "Inspect mounts and Lord bushings for cracking, deterioration, and sagging. A tired mount shows up as vibration, cowl misalignment, and exhaust cracking.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["engine", "airframe", "mounts"] }),
      schedule({ key: "inactivity_corrosion_prevention", name: "Fly or Preserve (Corrosion Prevention)", description: "If the airplane sits for 30 days, either fly it to full oil temperature or preserve it properly. Short runs and hand-pulling the prop do not solve the corrosion problem.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7, overdueCadenceDays: 7, maxOverdueNotifications: 3 }), tags: ["engine", "corrosion", "inactivity"] }),
      schedule({ key: "prop_overhaul", name: "Propeller Overhaul", description: "Plan propeller overhaul on both calendar and tach-hour limits. This is often coordinated with engine work to reduce downtime and ferry decisions.", triggerTemplate: { type: "compound", intervalDays: 2190, metricKey: "tach_hours", intervalValue: 2000, logic: "whichever_first", leadTimeDays: 90, leadTimeValue: 100 }, notificationConfig: aircraftPlanningNotification(90, 100), tags: ["propeller", "overhaul", "major"] }),
      schedule({ key: "prop_governor_service", name: "Propeller Governor Service", description: "Constant-speed prop governors need periodic internal inspection and reseal work. Skip this for fixed-pitch aircraft.", triggerTemplate: { type: "compound", intervalDays: 1825, metricKey: "hobbs_hours", intervalValue: 1500, logic: "whichever_first", leadTimeDays: 60, leadTimeValue: 100 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 60, upcomingLeadValue: 100 }), tags: ["propeller", "governor"] }),
      schedule({ key: "spinner_bulkhead_inspection", name: "Spinner and Bulkhead Inspection", description: "Inspect the spinner, backing plate, and attachment points for cracking before vibration becomes a larger cowl or crankshaft issue.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["propeller", "spinner", "inspection"] }),
      schedule({ key: "tire_inspection", name: "Tire Inspection and Replacement", description: "Track tires by landing cycles so flat spotting and cord wear do not surprise you away from home base.", triggerTemplate: { type: "usage", metricKey: "landing_cycles", intervalValue: 200, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 20 }), tags: ["airframe", "landing gear", "tires"] }),
      schedule({ key: "brake_inspection", name: "Brake Pad and Disc Inspection", description: "Brake wear varies with taxi length, ramp slope, and pilot technique. Using landing cycles gets you closer than pure calendar tracking.", triggerTemplate: { type: "usage", metricKey: "landing_cycles", intervalValue: 300, leadTimeValue: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 30 }), tags: ["airframe", "landing gear", "brakes"] }),
      schedule({ key: "landing_gear_service", name: "Landing Gear Service and Lubrication", description: "Lubricate wheel bearings, check struts and torque links, and inspect shimmy-damper or retractable-gear components before nuisance wear becomes an operational problem.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["airframe", "landing gear", "lubrication"] }),
      schedule({ key: "control_cable_inspection", name: "Flight Control Cable and Rigging Inspection", description: "Flight controls are safety-critical. Fraying, poor tension, pulley wear, and corrosion should be tracked explicitly instead of disappearing into annual paperwork.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["airframe", "controls", "safety"] }),
      schedule({ key: "corrosion_inspection", name: "Airframe Corrosion Inspection", description: "Inspect belly skins, wheel wells, battery areas, and moisture-prone structures, especially if the airplane lives outside or near salt air.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["airframe", "corrosion", "inspection"] }),
      schedule({ key: "window_inspection", name: "Windshield and Window Inspection", description: "Aircraft transparencies age from UV, cleaning products, and vibration. Catch crazing and edge delamination before visibility or replacement cost becomes painful.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["airframe", "windows", "inspection"] }),
      schedule({ key: "nav_database_update", name: "Navigation Database Update", description: "IFR nav databases roll every 28 days. This is frequent and low-effort, so it gets push notifications only.", triggerTemplate: { type: "interval", intervalDays: 28, leadTimeDays: 5 }, notificationConfig: notification({ channels: ["push"], upcomingLeadDays: 5, overdueCadenceDays: 3, maxOverdueNotifications: 3 }), tags: ["avionics", "navigation", "ifr"] }),
      schedule({ key: "avionics_cooling_check", name: "Avionics Cooling System Check", description: "Modern avionics fail from heat long before they fail from age. Inspect fans, ducting, and filters annually.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["avionics", "cooling", "inspection"] }),
      schedule({ key: "battery_service", name: "Aircraft Battery Service", description: "Service the main ship battery and verify the charging system while you are there. Weak cold starts are usually telling you something useful.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["electrical", "battery"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Aircraft insurance pricing and underwriting move with ratings, hours, claims, and hull value. Start early so you can compare quotes before the due date.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "winter_prep", name: "Winterization and Cold Weather Prep", description: "Prepare preheat, winter oil, baffling, and battery support before the first hard freeze so cold-weather dispatch is not a scramble.", triggerTemplate: { type: "seasonal", month: 10, day: 15, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["seasonal", "winter"] }),
      schedule({ key: "spring_prep", name: "Spring Season Prep and First Flight", description: "Do a thorough first-flight inspection after winter, including bird nests, insect contamination in ports, fuel vent checks, and a slow deliberate walk-around.", triggerTemplate: { type: "seasonal", month: 3, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["seasonal", "spring"] }),
      schedule({ key: "hangar_tiedown_renewal", name: "Hangar or Tie-Down Lease Renewal", description: "Storage spots are hard to replace. Track the renewal like a real operational dependency, not just an admin date.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 60 }), tags: ["ownership", "storage"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive Compliance Review", description: "Review all applicable recurring and one-time ADs at least annually. AD compliance is a legal requirement and should not be left to memory or annual-inspection discovery alone.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, and expiration date on the cabin fire extinguisher.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-piston-multi-engine",
    label: "Piston Multi-Engine Airplane",
    category: "aircraft",
    description: "A broad profile for cabin-class and training twins with dual-engine tracking, retractable-gear upkeep, prop synchronization, and the additional planning burden that comes with engine redundancy and systems complexity.",
    tags: ["aircraft", "aviation", "piston", "multi engine", "twin"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N987AB", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 2 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Beechcraft", group: "Registration & Airframe", order: 3 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "Baron 58", group: "Registration & Airframe", order: 4 }),
      field({ key: "leftEngineModel", label: "Left Engine Model", type: "string", group: "Left Engine", order: 0 }),
      field({ key: "leftEngineSerial", label: "Left Engine Serial", type: "string", group: "Left Engine", order: 1 }),
      field({ key: "leftEngineTsmoh", label: "Left Engine TSMOH", type: "number", group: "Left Engine", order: 2 }),
      field({ key: "rightEngineModel", label: "Right Engine Model", type: "string", group: "Right Engine", order: 0 }),
      field({ key: "rightEngineSerial", label: "Right Engine Serial", type: "string", group: "Right Engine", order: 1 }),
      field({ key: "rightEngineTsmoh", label: "Right Engine TSMOH", type: "number", group: "Right Engine", order: 2 }),
      field({ key: "engineTbo", label: "Engine TBO (hours)", type: "number", helpText: "Use the common recommended TBO if both engines share the same model. Track deviations in notes if one engine differs.", group: "Right Engine", order: 3 }),
      field({ key: "leftPropModel", label: "Left Propeller Model", type: "string", group: "Propellers & Gear", order: 0 }),
      field({ key: "rightPropModel", label: "Right Propeller Model", type: "string", group: "Propellers & Gear", order: 1 }),
      field({ key: "gearType", label: "Gear Type", type: "select", options: ["retractable tricycle", "retractable tailwheel", "fixed tricycle"], group: "Propellers & Gear", order: 2 }),
      field({ key: "propSyncInstalled", label: "Prop Sync Installed", type: "boolean", defaultValue: true, group: "Propellers & Gear", order: 3 }),
      field({ key: "fuelType", label: "Fuel Type", type: "select", options: ["100LL", "100VLL", "UL94", "autogas STC", "other"], group: "Mission Systems", order: 0 }),
      field({ key: "turbocharged", label: "Turbocharged", type: "boolean", defaultValue: false, group: "Mission Systems", order: 1 }),
      field({ key: "ifrCapable", label: "IFR Equipped", type: "boolean", defaultValue: true, group: "Mission Systems", order: 2 }),
      field({ key: "deIceType", label: "Ice Protection", type: "select", options: ["none", "boots", "hot props", "known ice package", "other"], group: "Mission Systems", order: 3 }),
      field({ key: "crossfeedInstalled", label: "Fuel Crossfeed Installed", type: "boolean", defaultValue: true, group: "Mission Systems", order: 4 }),
      field({ key: "heaterType", label: "Cabin Heater Type", type: "select", options: ["shroud heat", "combustion heater", "electric supplemental", "other"], group: "Mission Systems", order: 5 }),
      field({ key: "knownIceApproved", label: "Known Ice Approved", type: "boolean", defaultValue: false, group: "Mission Systems", order: 6 }),
      field({ key: "homeAirport", label: "Home Airport", type: "string", placeholder: "KAPA", group: "Operations & Support", order: 0 }),
      field({ key: "hangarOrTiedown", label: "Storage Type", type: "select", options: ["hangar", "shared hangar", "tie-down"], group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "recurrentTrainingProvider", label: "Recurrent Training Provider", type: "string", helpText: "Useful for twins where insurance and proficiency often drive annual or semiannual training requirements.", group: "Operations & Support", order: 3 }),
      field({ key: "mechanicName", label: "Twin-Capable Maintenance Shop", type: "string", group: "Operations & Support", order: 4 })
    ],
    metricTemplates: [
      metric({ key: "hobbs_hours", name: "Hobbs Hours", unit: "hours", startingValue: 0, helpText: "Use hobbs for routine servicing and dispatch-oriented maintenance." }),
      metric({ key: "tach_hours", name: "Tach Hours", unit: "hours", startingValue: 0, helpText: "Use tach for engine reserve and overhaul planning." }),
      metric({ key: "landing_cycles", name: "Landing Cycles", unit: "landings", startingValue: 0, allowManualEntry: true, helpText: "Useful for brakes, tires, and retractable-gear wear tracking." })
    ],
    scheduleTemplates: [
      schedule({ key: "annual_inspection", name: "Annual Inspection (14 CFR 91.409)", description: "Annual on a piston twin almost always uncovers more system-depth work than a simple single-engine annual. Build in shop time and budget for gear, engine, and fuel-system findings.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "inspection", "annual"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification (14 CFR 91.413)", description: "Required for transponder-equipped aircraft and usually handled with the pitot-static cycle.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check (14 CFR 91.411)", description: "Required for IFR operations. Multi-engine IFR dispatch often depends on this staying current with no wiggle room.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection", description: "Track the ELT as a real grounding item, not a throwaway annual line item.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Registration lapse grounds the airplane regardless of how well maintained the airframe is.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "fuel_crossfeed_check", name: "Fuel Crossfeed and Selector System Check", description: "The crossfeed system is central to abnormal and single-engine fuel management. Track selector detents, valve function, and placards explicitly.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["fuel", "systems", "multi engine"] }),
      schedule({ key: "combustion_heater_inspection", name: "Combustion Heater Inspection", description: "Combustion heaters and their fuel delivery hardware deserve explicit tracking because failures are both a reliability issue and a cabin safety issue.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["safety", "cabin", "heating"] }),
      schedule({ key: "engine_oil_service", name: "Twin Engine Oil and Filter Service", description: "Service both engines together on a common hobbs schedule unless engine-condition data gives you a reason to split them.", triggerTemplate: { type: "compound", intervalDays: 120, metricKey: "hobbs_hours", intervalValue: 50, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 5 }), tags: ["engine", "fluids", "oil"] }),
      schedule({ key: "magneto_service", name: "Magneto Service (Both Engines)", description: "Dual engines means double the ignition hardware, timing checks, and failure points. Keep magneto service from hiding inside the annual.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 500, leadTimeValue: 50 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 50 }), tags: ["engine", "ignition", "multi engine"] }),
      schedule({ key: "engine_overhaul_planning", name: "Engine Overhaul Reserve Planning", description: "Track overhaul exposure as a major planning event. Twins turn engine reserves into a strategic ownership cost, not just a maintenance line item.", triggerTemplate: { type: "compound", intervalDays: 4380, metricKey: "tach_hours", intervalValue: 1800, logic: "whichever_first", leadTimeDays: 180, leadTimeValue: 150 }, notificationConfig: aircraftPlanningNotification(180, 150), tags: ["engine", "overhaul", "financial"] }),
      schedule({ key: "propeller_overhaul", name: "Propeller Overhaul Planning", description: "Twin props should usually be planned as a coordinated event so downtime, balancing, and ferry planning stay manageable.", triggerTemplate: { type: "compound", intervalDays: 2190, metricKey: "tach_hours", intervalValue: 2000, logic: "whichever_first", leadTimeDays: 90, leadTimeValue: 100 }, notificationConfig: aircraftPlanningNotification(90, 100), tags: ["propeller", "overhaul", "major"] }),
      schedule({ key: "gear_retraction_system", name: "Retractable Gear System Inspection", description: "Retraction actuators, uplocks, downlocks, squat switches, and emergency extension systems deserve their own tracked service interval.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["airframe", "landing gear", "retractable"] }),
      schedule({ key: "gear_swing_test", name: "Landing Gear Swing / Functional Test", description: "A full gear operational test is worth tracking separately from annual paperwork on retractable twins because partial failures are expensive and operationally ugly.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 45 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 45 }), tags: ["airframe", "landing gear", "functional test"] }),
      schedule({ key: "turbocharger_inspection", name: "Turbocharger and Induction Inspection", description: "Turbo twins need deliberate attention on induction leaks, wastegate function, controller health, and hot-side cracking. Skip if naturally aspirated.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 200, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 20 }), tags: ["engine", "turbo", "induction"] }),
      schedule({ key: "prop_sync_check", name: "Prop Sync / Governor Balance Check", description: "Track vibration complaints, governor balance, and prop synchronization separately from overhaul planning. Passenger comfort and component life both depend on it.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["propeller", "governor", "vibration"] }),
      schedule({ key: "deice_system_inspection", name: "Ice Protection System Inspection", description: "Boots, hot props, windshield, and associated plumbing or electrical systems should be tracked explicitly if the airplane uses them operationally.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "ice protection", "inspection"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Twin insurance often ties directly to training, recurrent requirements, and total multi time. Start early.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "recurrent_training", name: "Annual Recurrent Training Review", description: "Track training or simulator refresh as an operational requirement because many insurers and safe operators treat it as effectively mandatory.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 45 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 45, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["training", "safety", "ownership"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive Compliance Review", description: "Review all applicable recurring and one-time ADs at least annually. AD compliance is a legal requirement and should not be left to memory or annual-inspection discovery alone.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, and expiration date on the cabin fire extinguisher.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] }),
      schedule({ key: "battery_service", name: "Aircraft Battery Service", description: "Twins may carry dual batteries. Track service for the whole electrical system.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["electrical", "battery"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-turboprop-utility",
    label: "Turboprop Airplane",
    category: "aircraft",
    description: "A broad turboprop profile for owner-flown and utility aircraft that balances regulatory inspections with hot-section planning, propeller reserve work, trend monitoring, and environmental-system upkeep.",
    tags: ["aircraft", "aviation", "turboprop", "turbine", "utility"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N45TP", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 2 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Pilatus", group: "Registration & Airframe", order: 3 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "PC-12", group: "Registration & Airframe", order: 4 }),
      field({ key: "engineModel", label: "Engine Model", type: "string", placeholder: "PT6A-67P", group: "Powerplant", order: 0 }),
      field({ key: "engineSerial", label: "Engine Serial Number", type: "string", group: "Powerplant", order: 1 }),
      field({ key: "engineProgram", label: "Engine Program / MSP", type: "string", helpText: "If you are on an engine program, track the program here because it changes overhaul and reserve decisions.", group: "Powerplant", order: 2 }),
      field({ key: "hotSectionInterval", label: "Hot Section Interval (hours)", type: "number", group: "Powerplant", order: 3 }),
      field({ key: "timeSinceHotSection", label: "Time Since Hot Section", type: "number", group: "Powerplant", order: 4 }),
      field({ key: "propModel", label: "Propeller Model", type: "string", group: "Propeller & Ice Protection", order: 0 }),
      field({ key: "propSerial", label: "Propeller Serial Number", type: "string", group: "Propeller & Ice Protection", order: 1 }),
      field({ key: "iceProtection", label: "Ice Protection", type: "select", options: ["none", "boots", "known ice package", "hot prop", "electrothermal"], group: "Propeller & Ice Protection", order: 2 }),
      field({ key: "propGovernorModel", label: "Prop Governor Model", type: "string", group: "Propeller & Ice Protection", order: 3 }),
      field({ key: "fuelType", label: "Fuel Type", type: "select", options: ["Jet-A", "SAF blend", "other"], group: "Mission Systems", order: 0 }),
      field({ key: "pressurized", label: "Pressurized", type: "boolean", defaultValue: true, group: "Mission Systems", order: 1 }),
      field({ key: "ifrCapable", label: "IFR Equipped", type: "boolean", defaultValue: true, group: "Mission Systems", order: 2 }),
      field({ key: "avionicsSuite", label: "Primary Avionics Suite", type: "string", placeholder: "Garmin G3000", group: "Mission Systems", order: 3 }),
      field({ key: "inertialSeparatorInstalled", label: "Inertial Separator / Intake Protection", type: "boolean", defaultValue: false, group: "Mission Systems", order: 4 }),
      field({ key: "starterGeneratorModel", label: "Starter-Generator Model", type: "string", group: "Mission Systems", order: 5 }),
      field({ key: "pressurizationType", label: "Pressurization Source", type: "select", options: ["bleed air", "electric", "not pressurized"], group: "Mission Systems", order: 6 }),
      field({ key: "homeAirport", label: "Home Airport", type: "string", placeholder: "KASE", group: "Operations & Support", order: 0 }),
      field({ key: "managementCompany", label: "Management Company or Operator", type: "string", group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "maintenanceTrackingProgram", label: "Maintenance Tracking Program", type: "string", placeholder: "CAMP, Flightdocs, Corridor", group: "Operations & Support", order: 3 }),
      field({ key: "preferredServiceCenter", label: "Preferred Service Center", type: "string", group: "Operations & Support", order: 4 })
    ],
    metricTemplates: [
      metric({ key: "airframe_hours", name: "Airframe Hours", unit: "hours", startingValue: 0, helpText: "Use for inspections, structural tracking, and general dispatch planning." }),
      metric({ key: "engine_hours", name: "Engine Hours", unit: "hours", startingValue: 0, helpText: "Use for hot section, trend monitoring, and turbine reserve planning." }),
      metric({ key: "landing_cycles", name: "Landing Cycles", unit: "cycles", startingValue: 0, allowManualEntry: true, helpText: "Useful for landing gear wear and some engine program tracking." })
    ],
    scheduleTemplates: [
      schedule({ key: "annual_or_phase_inspection", name: "Annual / Progressive Inspection Package", description: "Turboprops often operate on structured inspection programs rather than a simple owner mental model. Track the package as a real planning event with downtime built in.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "inspection", "phase"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification", description: "Standard 24-month certification cycle for transponder equipment.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check", description: "Required for IFR dispatch and commonly handled with RVSM or transponder-related avionics work.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection", description: "Annual ELT operational and installation inspection.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Track aircraft registration separately from any commercial operator paperwork or management records.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "engine_trend_review", name: "Engine Trend Data Review", description: "Turboprops reward disciplined trend tracking. Make EGT, torque, ITT, fuel flow, and vibration review a recurring operational task rather than an afterthought.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 50, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 5 }), tags: ["engine", "monitoring", "turbine"] }),
      schedule({ key: "inertial_separator_inspection", name: "Intake Protection / Inertial Separator Inspection", description: "If the airplane operates from gravel, snow, or dirty strips, intake protection deserves its own tracked inspection interval.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["engine", "intake", "environment"] }),
      schedule({ key: "compressor_wash", name: "Compressor Wash", description: "Salt, dust, and short-hop operation accelerate compressor contamination. A scheduled wash keeps performance and fuel burn from quietly drifting.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 5 }), tags: ["engine", "turbine", "cleaning"] }),
      schedule({ key: "hot_section_planning", name: "Hot Section Inspection Planning", description: "Treat the hot section as a long-range shop planning and cash-planning event, not a last-minute dispatch surprise.", triggerTemplate: { type: "compound", intervalDays: 2190, metricKey: "engine_hours", intervalValue: 1800, logic: "whichever_first", leadTimeDays: 120, leadTimeValue: 150 }, notificationConfig: aircraftPlanningNotification(120, 150), tags: ["engine", "turbine", "major"] }),
      schedule({ key: "fuel_nozzle_inspection", name: "Fuel Nozzle / Fuel Control Inspection", description: "Track nozzle cleanliness and fuel-system health before hot starts, roughness, or spread issues develop into operational headaches.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 400, leadTimeValue: 40 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 40 }), tags: ["engine", "fuel", "inspection"] }),
      schedule({ key: "propeller_overhaul", name: "Propeller Overhaul Planning", description: "Large turboprop propeller overhauls need real lead time for shop scheduling, logistics, and balancing.", triggerTemplate: { type: "compound", intervalDays: 2190, metricKey: "engine_hours", intervalValue: 3500, logic: "whichever_first", leadTimeDays: 120, leadTimeValue: 200 }, notificationConfig: aircraftPlanningNotification(120, 200), tags: ["propeller", "overhaul", "major"] }),
      schedule({ key: "prop_governor_service", name: "Propeller Governor Service", description: "Large constant-speed governors are their own maintenance item and should not be hidden inside prop overhaul planning.", triggerTemplate: { type: "compound", intervalDays: 1825, metricKey: "engine_hours", intervalValue: 1500, logic: "whichever_first", leadTimeDays: 60, leadTimeValue: 100 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 60, upcomingLeadValue: 100 }), tags: ["propeller", "governor"] }),
      schedule({ key: "chip_detector_check", name: "Chip Detector and Oil Debris Review", description: "Any metal trend deserves immediate attention on a turbine. Make chip checks visible and recurring.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 3 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 3, overdueCadenceDays: 7, maxOverdueNotifications: 3 }), tags: ["engine", "monitoring", "safety"] }),
      schedule({ key: "starter_generator_inspection", name: "Starter-Generator Inspection", description: "Starter-generators are a dispatch item on turbine aircraft. Track brushes, connections, and output health before they become an AOG issue.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 400, leadTimeValue: 40 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 40 }), tags: ["electrical", "starting", "dispatch"] }),
      schedule({ key: "bleed_air_pressurization_check", name: "Bleed Air / Pressurization System Check", description: "Pressurization leaks and bleed-air issues usually show up as comfort complaints first and dispatch problems later. Track them before they escalate.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["pressurization", "environmental", "inspection"] }),
      schedule({ key: "ice_protection_inspection", name: "Ice Protection System Inspection", description: "Boots, bleed-air, electrothermal, or hot-prop systems should be checked before winter or known-ice dispatch.", triggerTemplate: { type: "seasonal", month: 10, day: 1, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["seasonal", "ice protection", "safety"] }),
      schedule({ key: "nav_database_update", name: "Navigation Database Update", description: "High-end IFR avionics still live on the 28-day cycle no matter how capable the airplane is.", triggerTemplate: { type: "interval", intervalDays: 28, leadTimeDays: 5 }, notificationConfig: notification({ channels: ["push"], upcomingLeadDays: 5, overdueCadenceDays: 3, maxOverdueNotifications: 3 }), tags: ["avionics", "navigation", "ifr"] }),
      schedule({ key: "battery_service", name: "Aircraft Battery Service", description: "Battery health matters on turbine starts because weak batteries can cascade into hot-start and dispatch issues quickly.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["electrical", "battery"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Coverage, hull value, and training requirements on turboprops justify treating insurance like a tracked ownership deadline.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive Compliance Review", description: "Review all applicable turbine-specific ADs and engine service bulletins at least annually. Dispatch-critical turbine findings should not be left to memory or inspection-package surprise.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, and expiration date on the cabin fire extinguisher.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-business-jet",
    label: "Business Jet",
    category: "aircraft",
    description: "A profile for owner-operated and managed business jets with APU tracking, RVSM-oriented avionics compliance, landing-gear lifecycle work, and cabin-system dependencies that matter for dispatch reliability.",
    tags: ["aircraft", "aviation", "jet", "business aviation", "turbine"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N700BJ", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 2 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Cessna", group: "Registration & Airframe", order: 3 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "Citation CJ3+", group: "Registration & Airframe", order: 4 }),
      field({ key: "leftEngineModel", label: "Left Engine Model", type: "string", group: "Powerplants", order: 0 }),
      field({ key: "rightEngineModel", label: "Right Engine Model", type: "string", group: "Powerplants", order: 1 }),
      field({ key: "engineProgram", label: "Engine Program", type: "string", placeholder: "PowerAdvantage+, MSP", group: "Powerplants", order: 2 }),
      field({ key: "apuModel", label: "APU Model", type: "string", group: "Powerplants", order: 3 }),
      field({ key: "apuSerial", label: "APU Serial Number", type: "string", group: "Powerplants", order: 4 }),
      field({ key: "avionicsSuite", label: "Avionics Suite", type: "string", placeholder: "Garmin G3000", group: "Cabin & Avionics", order: 0 }),
      field({ key: "rvsmCapable", label: "RVSM Capable", type: "boolean", defaultValue: true, group: "Cabin & Avionics", order: 1 }),
      field({ key: "fmsProvider", label: "Database Provider", type: "select", options: ["Garmin", "Jeppesen", "Honeywell", "Collins", "other"], group: "Cabin & Avionics", order: 2 }),
      field({ key: "satcomInstalled", label: "Satcom Installed", type: "boolean", defaultValue: false, group: "Cabin & Avionics", order: 3 }),
      field({ key: "pressurized", label: "Pressurized", type: "boolean", defaultValue: true, group: "Cabin & Avionics", order: 4 }),
      field({ key: "thrustReversersInstalled", label: "Thrust Reversers Installed", type: "boolean", defaultValue: false, group: "Cabin & Avionics", order: 5 }),
      field({ key: "brakeMaterial", label: "Brake Material", type: "select", options: ["steel", "carbon", "other"], group: "Cabin & Avionics", order: 6 }),
      field({ key: "cabinOxygenInstalled", label: "Passenger Oxygen Installed", type: "boolean", defaultValue: true, group: "Cabin & Avionics", order: 7 }),
      field({ key: "homeAirport", label: "Home Base Airport", type: "string", placeholder: "KTEB", group: "Operations & Support", order: 0 }),
      field({ key: "managementCompany", label: "Management Company", type: "string", group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "trainingProvider", label: "Training Provider", type: "string", placeholder: "FlightSafety, CAE", group: "Operations & Support", order: 3 }),
      field({ key: "maintenanceTrackingProgram", label: "Maintenance Tracking Program", type: "string", placeholder: "CAMP, Flightdocs", group: "Operations & Support", order: 4 })
    ],
    metricTemplates: [
      metric({ key: "airframe_hours", name: "Airframe Hours", unit: "hours", startingValue: 0, helpText: "Use for phase inspections and structural planning." }),
      metric({ key: "engine_hours", name: "Engine Hours", unit: "hours", startingValue: 0, helpText: "Use for engine program review, borescope events, and reserve planning." }),
      metric({ key: "landing_cycles", name: "Landing Cycles", unit: "cycles", startingValue: 0, allowManualEntry: true, helpText: "Jets often care about cycles as much as hours for brakes, wheels, and some life-limited components." }),
      metric({ key: "apu_hours", name: "APU Hours", unit: "hours", startingValue: 0, helpText: "Track APU service separately from airframe and engine hours." })
    ],
    scheduleTemplates: [
      schedule({ key: "phase_inspection", name: "Phase / Program Inspection", description: "Jets rarely live on a simple owner annual mindset. Treat scheduled inspection packages as the backbone of dispatch planning.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 45 }, notificationConfig: aircraftGroundingNotification(45), tags: ["regulatory", "inspection", "phase"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification", description: "Standard 24-month transponder certification for a transponder-equipped jet.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check", description: "Core IFR compliance item and commonly coordinated with RVSM checks.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "rvsm_review", name: "RVSM Compliance Review", description: "Treat RVSM documentation and system readiness as a first-class operational dependency when the aircraft routinely uses the flight levels.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "rvsm"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection", description: "Annual ELT inspection and logbook signoff.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Registration remains a hard no-go item regardless of management oversight or operator size.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "apu_service", name: "APU Service", description: "The APU quietly drives dispatch reliability on the ground. Track its service separately so it does not become an invisible weak link.", triggerTemplate: { type: "usage", metricKey: "apu_hours", intervalValue: 150, leadTimeValue: 15 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 15 }), tags: ["apu", "engine", "dispatch"] }),
      schedule({ key: "engine_borescope", name: "Engine Borescope / Trend Review", description: "A scheduled borescope and trend-data review catches early turbine distress before it becomes an AOG event.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 500, leadTimeValue: 50 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 50 }), tags: ["engine", "turbine", "inspection"] }),
      schedule({ key: "thrust_reverser_inspection", name: "Thrust Reverser Inspection", description: "If equipped, thrust reversers deserve their own functional and hardware inspection cycle because dispatch limitations and deferred defects compound quickly.", triggerTemplate: { type: "usage", metricKey: "landing_cycles", intervalValue: 300, leadTimeValue: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 30 }), tags: ["engine", "dispatch", "inspection"] }),
      schedule({ key: "brake_pack_wear_review", name: "Brake Pack and Wheel Wear Review", description: "Jets consume brakes by cycles, not just calendar time. Make wear review a recurring cycle-based item rather than waiting for line findings.", triggerTemplate: { type: "usage", metricKey: "landing_cycles", intervalValue: 200, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 20 }), tags: ["landing gear", "brakes", "cycles"] }),
      schedule({ key: "oxygen_system_service", name: "Oxygen System Service", description: "Crew and passenger oxygen capability matters operationally. Keep bottle condition, fill status, and hydrostatic timelines visible.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "oxygen", "cabin"] }),
      schedule({ key: "emergency_equipment_review", name: "Emergency Equipment Review", description: "Rafts, fire extinguishers, flashlights, ELT remote panels, and cabin emergency equipment need a deliberate review cycle on cabin-class aircraft.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["safety", "cabin", "dispatch"] }),
      schedule({ key: "cabin_pressurization_check", name: "Cabin Pressurization Leak and Controller Check", description: "A small pressurization issue becomes a dispatch problem fast on a jet. Keep controller behavior, seals, and leak complaints visible.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["pressurization", "cabin", "inspection"] }),
      schedule({ key: "landing_gear_detailed", name: "Landing Gear Detailed Inspection", description: "Jets impose real load on wheels, brakes, actuators, and retraction systems. Treat landing gear as a lifecycle system with its own clock.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 60 }), tags: ["airframe", "landing gear", "inspection"] }),
      schedule({ key: "nav_database_update", name: "Navigation Database Update", description: "IFR databases, charts, and FMS data remain a frequent but low-friction recurring item.", triggerTemplate: { type: "interval", intervalDays: 28, leadTimeDays: 5 }, notificationConfig: notification({ channels: ["push"], upcomingLeadDays: 5, overdueCadenceDays: 3, maxOverdueNotifications: 3 }), tags: ["avionics", "navigation", "ifr"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Managed jets still need deliberate renewal tracking because hull values, crew requirements, and operating profile changes all affect coverage.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive and Service Bulletin Compliance Review", description: "Jets accumulate AD and SB exposure faster than most piston aircraft. Track compliance review as a formal recurring task.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify all cabin and cockpit fire extinguisher units for gauge, condition, and expiration.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] }),
      schedule({ key: "rvsm_check", name: "RVSM Equipment Recertification", description: "RVSM compliance requires periodic altimetry system checks. Track this as a dispatch-critical item for high-altitude operations.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "rvsm", "avionics"] }),
      schedule({ key: "cabin_systems_review", name: "Cabin Systems and Entertainment Review", description: "WiFi, entertainment, galley, lavatory, and cabin management systems affect dispatch reliability for managed jets. Track a periodic functional review.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["cabin", "systems", "dispatch"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-helicopter-rotorcraft",
    label: "Helicopter / Rotorcraft",
    category: "aircraft",
    description: "A rotorcraft-focused profile for helicopters that prioritizes rotor system oversight, transmission health, chip checks, and the hour-sensitive maintenance cadence common to rotary-wing aircraft.",
    tags: ["aircraft", "aviation", "helicopter", "rotorcraft", "rotary wing"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N52RW", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 2 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Robinson", group: "Registration & Airframe", order: 3 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "R44 Raven II", group: "Registration & Airframe", order: 4 }),
      field({ key: "engineModel", label: "Engine Model", type: "string", group: "Powertrain", order: 0 }),
      field({ key: "engineSerial", label: "Engine Serial Number", type: "string", group: "Powertrain", order: 1 }),
      field({ key: "transmissionModel", label: "Transmission Model", type: "string", group: "Powertrain", order: 2 }),
      field({ key: "transmissionSerial", label: "Transmission Serial", type: "string", group: "Powertrain", order: 3 }),
      field({ key: "mainRotorBladeSet", label: "Main Rotor Blade Set", type: "string", group: "Rotor System", order: 0 }),
      field({ key: "tailRotorBladeSet", label: "Tail Rotor Blade Set", type: "string", group: "Rotor System", order: 1 }),
      field({ key: "landingGearType", label: "Landing Gear", type: "select", options: ["skids", "wheels", "floats"], group: "Rotor System", order: 2 }),
      field({ key: "rotorSystemType", label: "Rotor System Type", type: "select", options: ["semi-rigid", "articulated", "rigid", "coaxial", "fenestron tail"], group: "Rotor System", order: 3 }),
      field({ key: "mastSerial", label: "Main Mast Serial", type: "string", group: "Rotor System", order: 4 }),
      field({ key: "mainGearboxSerial", label: "Main Gearbox Serial", type: "string", group: "Rotor System", order: 5 }),
      field({ key: "engineType", label: "Engine Type", type: "select", options: ["piston", "turbine"], group: "Mission Systems", order: 0 }),
      field({ key: "ifrCapable", label: "IFR Equipped", type: "boolean", defaultValue: false, group: "Mission Systems", order: 1 }),
      field({ key: "externalLoadApproved", label: "External Load Approved", type: "boolean", defaultValue: false, group: "Mission Systems", order: 2 }),
      field({ key: "homeAirport", label: "Base Airport or Helipad", type: "string", placeholder: "KFUL", group: "Operations & Support", order: 0 }),
      field({ key: "operatorType", label: "Typical Mission", type: "select", options: ["training", "private", "utility", "charter", "survey", "other"], group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "maintenanceProvider", label: "Rotorcraft Maintenance Provider", type: "string", group: "Operations & Support", order: 3 })
    ],
    metricTemplates: [
      metric({ key: "airframe_hours", name: "Airframe Hours", unit: "hours", startingValue: 0, helpText: "The core helicopter maintenance metric for many airframe and inspection events." }),
      metric({ key: "engine_hours", name: "Engine Hours", unit: "hours", startingValue: 0, helpText: "Track engine-specific service and trend items." }),
      metric({ key: "rotor_cycles", name: "Rotor Cycles", unit: "cycles", startingValue: 0, allowManualEntry: true, helpText: "Useful for certain component lives and hard-use operational tracking." })
    ],
    scheduleTemplates: [
      schedule({ key: "annual_inspection", name: "Annual Inspection (14 CFR 91.409)", description: "Rotorcraft annuals should be treated as deep mechanical inspections with real attention on mast, hub, transmission, and vibration-related findings.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "inspection", "annual"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification", description: "Track the standard transponder certification cycle when equipped.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check", description: "Relevant for IFR-capable rotorcraft and should stay visible even if the aircraft is mostly flown VFR.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection", description: "Annual ELT inspection with battery and installation review.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Hard legal deadline for continued operation.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "hundred_hour_inspection", name: "100-Hour Inspection", description: "Rotorcraft often benefit from treating the 100-hour rhythm as a first-class maintenance cadence, especially in training or utility use.", triggerTemplate: { type: "usage", metricKey: "airframe_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["inspection", "airframe", "hourly"] }),
      schedule({ key: "swashplate_lubrication", name: "Swashplate and Rotor Head Lubrication", description: "Rotor head lubrication is routine, but skipping it accelerates wear and vibration. Keep it visible on a short cadence.", triggerTemplate: { type: "usage", metricKey: "airframe_hours", intervalValue: 50, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 5 }), tags: ["rotor", "lubrication", "wear"] }),
      schedule({ key: "transmission_oil_service", name: "Transmission Oil and Filter Service", description: "Transmission health is central to rotorcraft safety. Oil condition and filter contamination should not disappear into generic maintenance notes.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["powertrain", "fluids", "safety"] }),
      schedule({ key: "rotor_track_balance", name: "Rotor Track and Balance Review", description: "Vibration management is a rotorcraft reliability issue, a fatigue issue, and a pilot comfort issue. Keep it visible.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["rotor", "vibration", "inspection"] }),
      schedule({ key: "mast_and_hub_inspection", name: "Main Mast and Hub Inspection", description: "The mast, hub, and attachment hardware deserve explicit tracked attention because they live at the center of rotorcraft fatigue exposure.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["rotor", "hub", "safety"] }),
      schedule({ key: "main_rotor_blade_inspection", name: "Main Rotor Blade Inspection", description: "Track blade condition, attachment hardware, and corrosion independently because blade issues are too consequential to bury.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["rotor", "inspection", "safety"] }),
      schedule({ key: "freewheel_clutch_inspection", name: "Freewheel Clutch / Sprag Inspection", description: "Freewheel clutch health matters during autorotation and abnormal operation. It is too important to leave implicit.", triggerTemplate: { type: "usage", metricKey: "airframe_hours", intervalValue: 300, leadTimeValue: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 30 }), tags: ["powertrain", "autorotation", "safety"] }),
      schedule({ key: "tail_rotor_drive_inspection", name: "Tail Rotor Drive Inspection", description: "Tail rotor and drive components are safety-critical and merit explicit maintenance visibility.", triggerTemplate: { type: "usage", metricKey: "airframe_hours", intervalValue: 300, leadTimeValue: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 30 }), tags: ["rotor", "tail rotor", "safety"] }),
      schedule({ key: "tail_rotor_gearbox_service", name: "Tail Rotor Gearbox Service", description: "Tail rotor gearbox oil, seals, and chip monitoring need their own recurring service cadence.", triggerTemplate: { type: "usage", metricKey: "engine_hours", intervalValue: 200, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 20 }), tags: ["rotor", "gearbox", "fluids"] }),
      schedule({ key: "chip_detector_check", name: "Chip Detector Check", description: "Frequent chip checks are an early warning mechanism for powertrain distress and should be treated seriously.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 3 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 3, overdueCadenceDays: 7, maxOverdueNotifications: 3 }), tags: ["powertrain", "monitoring", "safety"] }),
      schedule({ key: "engine_inlet_filter_service", name: "Engine Inlet / Filter Service", description: "Rotorcraft live in dirty air near the ground. Track inlet filters or barrier systems on a short service cadence.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 5 }), tags: ["engine", "filters", "environment"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Rotorcraft underwriting can be sensitive to mission type and pilot currency. Renew early and review coverage assumptions.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive Compliance Review", description: "Rotorcraft AD exposure includes dynamic components, rotor systems, and transmission hardware. Review compliance at least annually.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, and expiration date on the cabin fire extinguisher.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-glider-sailplane",
    label: "Glider / Sailplane",
    category: "aircraft",
    description: "A sailplane-focused profile for gliders and motorgliders that emphasizes annual condition inspection, launch-system hardware, rigging integrity, canopy care, and trailer dependence.",
    tags: ["aircraft", "aviation", "glider", "sailplane", "soaring"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "Registration Number", type: "string", required: true, placeholder: "N321SG", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Schempp-Hirth", group: "Registration & Airframe", order: 2 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "Discus 2b", group: "Registration & Airframe", order: 3 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 4 }),
      field({ key: "launchType", label: "Primary Launch Method", type: "select", options: ["aerotow", "winch", "self-launch", "sustainer"], group: "Launch & Rigging", order: 0 }),
      field({ key: "towReleaseSerial", label: "Tow Release Serial", type: "string", group: "Launch & Rigging", order: 1 }),
      field({ key: "wingSpan", label: "Wingspan", type: "number", unit: "m", group: "Launch & Rigging", order: 2 }),
      field({ key: "waterBallastInstalled", label: "Water Ballast Installed", type: "boolean", defaultValue: false, group: "Launch & Rigging", order: 3 }),
      field({ key: "airframeMaterial", label: "Airframe Material", type: "select", options: ["composite", "wood", "metal tube and fabric", "mixed"], group: "Launch & Rigging", order: 4 }),
      field({ key: "selfLaunchEngineModel", label: "Self-Launch / Sustainer Engine", type: "string", group: "Launch & Rigging", order: 5 }),
      field({ key: "wingletInstalled", label: "Winglets Installed", type: "boolean", defaultValue: false, group: "Launch & Rigging", order: 6 }),
      field({ key: "oxygenInstalled", label: "Oxygen Installed", type: "boolean", defaultValue: false, group: "Cockpit & Safety", order: 0 }),
      field({ key: "flarmInstalled", label: "FLARM / Collision Device", type: "boolean", defaultValue: false, group: "Cockpit & Safety", order: 1 }),
      field({ key: "transponderInstalled", label: "Transponder Installed", type: "boolean", defaultValue: false, group: "Cockpit & Safety", order: 2 }),
      field({ key: "trailerSerial", label: "Trailer Serial Number", type: "string", group: "Trailer & Storage", order: 0 }),
      field({ key: "trailerTireSize", label: "Trailer Tire Size", type: "string", group: "Trailer & Storage", order: 1 }),
      field({ key: "storageLocation", label: "Storage Location", type: "string", placeholder: "Club trailer row", group: "Trailer & Storage", order: 2 }),
      field({ key: "homeAirport", label: "Home Airport / Club", type: "string", placeholder: "KCVH", group: "Operations & Support", order: 0 }),
      field({ key: "clubOrOperator", label: "Club or Operator", type: "string", group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 })
    ],
    metricTemplates: [
      metric({ key: "flight_hours", name: "Flight Hours", unit: "hours", startingValue: 0, helpText: "Use for general glider flight time tracking." }),
      metric({ key: "launch_cycles", name: "Launch Cycles", unit: "launches", startingValue: 0, allowManualEntry: true, helpText: "Useful for tow release, gear, and repetitive launch hardware inspection." })
    ],
    scheduleTemplates: [
      schedule({ key: "annual_condition_inspection", name: "Annual Condition Inspection", description: "Track the yearly airworthiness and condition review for the sailplane as the primary legal maintenance event.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 45 }, notificationConfig: aircraftGroundingNotification(45), tags: ["regulatory", "inspection", "annual"] }),
      schedule({ key: "registration_renewal", name: "Registration Renewal", description: "Registration still matters even when the maintenance profile is lighter than powered aircraft.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "tow_release_inspection", name: "Tow Release Inspection", description: "Tow release hardware is a primary safety system and should be tracked by launch count, not vague memory.", triggerTemplate: { type: "usage", metricKey: "launch_cycles", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["launch", "safety", "inspection"] }),
      schedule({ key: "wing_root_pin_inspection", name: "Wing Root Pin and Attachment Inspection", description: "Sailplane rigging hardware and wing pins deserve deliberate tracking because assembly errors and wear both carry serious consequences.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["airframe", "rigging", "safety"] }),
      schedule({ key: "control_rigging_inspection", name: "Control Rigging and Connection Inspection", description: "Rigging mistakes are too serious to leave to seasonal habit. Track control hookups and rigging inspection explicitly.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["controls", "rigging", "safety"] }),
      schedule({ key: "airbrake_function_check", name: "Airbrake / Spoiler Function Check", description: "Spoilers and airbrakes are central landing-control devices on gliders and deserve their own recurring function review.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["airframe", "landing", "controls"] }),
      schedule({ key: "canopy_inspection", name: "Canopy and Transparency Inspection", description: "Canopies see UV, scratches, and seal wear. Keep visibility and latch integrity under active review.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["airframe", "canopy", "inspection"] }),
      schedule({ key: "water_ballast_system_inspection", name: "Water Ballast System Inspection", description: "If the glider carries ballast, inspect plumbing, dump valves, seals, and tank integrity before competition or cross-country season.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["performance", "ballast", "inspection"] }),
      schedule({ key: "battery_service", name: "Battery and Avionics Power Check", description: "Even simple glider avionics depend on healthy batteries. Verify capacity before cross-country season.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["electrical", "battery"] }),
      schedule({ key: "trailer_bearings", name: "Trailer Bearings and Tires", description: "A glider that cannot travel safely in its trailer is functionally grounded for many operators. Track the trailer like it matters, because it does.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["trailer", "storage", "transport"] }),
      schedule({ key: "trailer_lights_brakes", name: "Trailer Lights and Brake System Check", description: "A glider trailer is part of the operating system. Lights, brakes, and tie-down hardware should be reviewed before travel season.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["trailer", "transport", "safety"] }),
      schedule({ key: "oxygen_service", name: "Oxygen System Service", description: "If the glider flies high enough to need oxygen, keep the bottle, regulator, and plumbing in a visible maintenance rhythm.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "oxygen"] }),
      schedule({ key: "transponder_check", name: "Transponder / Altimeter Check", description: "Use this for transponder-equipped sailplanes operating in controlled airspace. Skip if the aircraft is not so equipped.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Renew early enough to review hull value, club or storage arrangements, and cross-country coverage assumptions.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "If the glider carries an ELT, track the battery expiration date independently from the annual inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "If the glider carries a fire extinguisher, verify condition and expiration annually.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-floatplane-amphibious",
    label: "Floatplane / Amphibious Airplane",
    category: "aircraft",
    description: "A water-operations-focused profile for floatplanes and amphibious airplanes. Adds float hardware, corrosion control, bilge and compartment integrity, water rudder service, and amphibious-gear risk management on top of standard aircraft inspections.",
    tags: ["aircraft", "aviation", "seaplane", "floatplane", "amphibious"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N18SP", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "Cessna", group: "Registration & Airframe", order: 2 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "185 Skywagon", group: "Registration & Airframe", order: 3 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 4 }),
      field({ key: "engineModel", label: "Engine Model", type: "string", group: "Powerplant", order: 0 }),
      field({ key: "engineTbo", label: "Engine TBO (hours)", type: "number", group: "Powerplant", order: 1 }),
      field({ key: "floatManufacturer", label: "Float Manufacturer", type: "string", group: "Float System", order: 0 }),
      field({ key: "floatModel", label: "Float Model", type: "string", group: "Float System", order: 1 }),
      field({ key: "floatSerial", label: "Float Serial Number", type: "string", group: "Float System", order: 2 }),
      field({ key: "amphibiousGear", label: "Amphibious Gear Installed", type: "boolean", defaultValue: false, group: "Float System", order: 3 }),
      field({ key: "floatCompartmentCount", label: "Float Compartment Count", type: "number", group: "Float System", order: 4 }),
      field({ key: "bilgePumpType", label: "Bilge Pump Type", type: "select", options: ["manual", "electric", "both", "none"], group: "Float System", order: 5 }),
      field({ key: "waterRudderInstalled", label: "Water Rudders Installed", type: "boolean", defaultValue: true, group: "Float System", order: 6 }),
      field({ key: "fuelType", label: "Fuel Type", type: "select", options: ["100LL", "100VLL", "UL94", "autogas STC", "other"], group: "Mission Systems", order: 0 }),
      field({ key: "ifrCapable", label: "IFR Equipped", type: "boolean", defaultValue: false, group: "Mission Systems", order: 1 }),
      field({ key: "freshWaterRinseRoutine", label: "Freshwater Rinse Routine", type: "boolean", defaultValue: false, helpText: "Especially important if the airplane sees saltwater or brackish operations.", group: "Mission Systems", order: 2 }),
      field({ key: "mooringLocation", label: "Dock / Mooring Location", type: "string", group: "Operations & Support", order: 0 }),
      field({ key: "winterStorageMode", label: "Winter Storage Mode", type: "select", options: ["hangar", "dock", "beach", "trailer"], group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "floatShop", label: "Float / Amphibious Shop", type: "string", group: "Operations & Support", order: 3 })
    ],
    metricTemplates: [
      metric({ key: "hobbs_hours", name: "Hobbs Hours", unit: "hours", startingValue: 0, helpText: "General runtime and service metric." }),
      metric({ key: "tach_hours", name: "Tach Hours", unit: "hours", startingValue: 0, helpText: "Use for overhaul and propeller planning." }),
      metric({ key: "water_cycles", name: "Water Cycles", unit: "water landings", startingValue: 0, allowManualEntry: true, helpText: "Useful for float and water-rudder related wear." })
    ],
    scheduleTemplates: [
      schedule({ key: "annual_inspection", name: "Annual Inspection (14 CFR 91.409)", description: "Water-operation airplanes still live under the same annual requirement, but float fittings, spreader bars, and corrosion exposure make the annual significantly more specialized.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "inspection", "annual"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification", description: "Track the biennial transponder certification if equipped.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check", description: "Required for IFR floatplane operation and worth keeping visible even if the airplane is mostly VFR.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection", description: "Annual ELT inspection and mounting review in a damp environment.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Treat registration as a grounding event just like any other aircraft subtype.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "float_compartment_integrity", name: "Float Compartment Integrity and Leak Check", description: "Check compartments for leaks, water accumulation, access-plate sealing, and structural distortion. Float integrity is operationally critical, not optional.", triggerTemplate: { type: "interval", intervalDays: 90, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["floats", "water ops", "safety"] }),
      schedule({ key: "bilge_pump_inspection", name: "Bilge Pump Inspection", description: "Electric and manual bilge capability should be checked on a short cadence so water ingress does not become a surprise at the dock.", triggerTemplate: { type: "interval", intervalDays: 90, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7 }), tags: ["floats", "water ops", "inspection"] }),
      schedule({ key: "water_rudder_service", name: "Water Rudder Cable and Steering Service", description: "Water rudders live in a harsh environment and directly affect controllability on the step and at the dock.", triggerTemplate: { type: "usage", metricKey: "water_cycles", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["floats", "controls", "water ops"] }),
      schedule({ key: "amphibious_gear_system", name: "Amphibious Gear Position System Inspection", description: "If the airplane has amphibs, the gear-position indication and mechanical system are safety-critical. This is the classic wheels-down-in-water / wheels-up-on-land trap.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["amphibious", "gear", "safety"] }),
      schedule({ key: "corrosion_control_program", name: "Corrosion Control and Freshwater Rinse Review", description: "Salt and freshwater intrusion are relentless on float hardware, belly skins, cables, and fittings. Track corrosion mitigation as a recurring discipline, not a vague intention.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 5, overdueCadenceDays: 14, maxOverdueNotifications: 3 }), tags: ["corrosion", "water ops", "airframe"] }),
      schedule({ key: "float_fittings_spreader_bar", name: "Float Fittings and Spreader Bar Inspection", description: "Spreader bars, fittings, and attach points carry the whole water-handling load path and should be tracked explicitly.", triggerTemplate: { type: "usage", metricKey: "water_cycles", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["floats", "structure", "inspection"] }),
      schedule({ key: "dock_mooring_renewal", name: "Dock / Mooring Agreement Renewal", description: "A floatplane without assured mooring or dock arrangements can be effectively grounded by logistics, not maintenance. Track the renewal like a real dependency.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 60 }), tags: ["ownership", "storage", "water ops"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Water operation, hull value, and seasonal exposure can move floatplane insurance materially. Start early.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive Compliance Review", description: "Review all applicable recurring and one-time ADs, including float STC ADs and float-system directives, at least annually.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, and expiration date on the cabin fire extinguisher.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-experimental-homebuilt",
    label: "Experimental / Homebuilt Aircraft",
    category: "aircraft",
    description: "A deeply flexible profile for experimental amateur-built and similar owner-maintained aircraft. Distinguishes the yearly condition inspection from a standard-category annual and emphasizes configuration control, firewall-forward oversight, and builder-specific systems.",
    tags: ["aircraft", "aviation", "experimental", "homebuilt", "amateur built"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N77XB", group: "Certification & Airframe", order: 0 }),
      field({ key: "airworthinessCertificateType", label: "Certificate Basis", type: "select", options: ["experimental amateur-built", "experimental exhibition", "experimental light-sport", "other"], group: "Certification & Airframe", order: 1 }),
      field({ key: "builderName", label: "Primary Builder", type: "string", group: "Certification & Airframe", order: 2 }),
      field({ key: "repairmanCertificateHolder", label: "Repairman Certificate Holder", type: "string", helpText: "Useful because experimental condition inspections may be signed off by the holder of the repairman certificate for that aircraft rather than an IA annual signoff.", group: "Certification & Airframe", order: 3 }),
      field({ key: "operatingLimitationsRevision", label: "Operating Limitations Revision", type: "string", group: "Certification & Airframe", order: 4 }),
      field({ key: "engineType", label: "Engine Type", type: "select", options: ["certified piston", "auto conversion", "rotary", "turbine conversion", "other"], group: "Firewall Forward", order: 0 }),
      field({ key: "engineModel", label: "Engine Model", type: "string", group: "Firewall Forward", order: 1 }),
      field({ key: "engineSerial", label: "Engine Serial Number", type: "string", group: "Firewall Forward", order: 2 }),
      field({ key: "ignitionType", label: "Ignition Type", type: "select", options: ["magnetos", "electronic", "dual electronic", "mixed"], group: "Firewall Forward", order: 3 }),
      field({ key: "propType", label: "Propeller Type", type: "select", options: ["fixed pitch", "constant speed", "ground adjustable", "composite"], group: "Firewall Forward", order: 4 }),
      field({ key: "efisSuite", label: "EFIS / Panel Suite", type: "string", placeholder: "Dynon, Garmin, GRT, Advanced Flight", group: "Avionics & Configuration", order: 0 }),
      field({ key: "configurationBaselineDate", label: "Configuration Baseline Date", type: "date", group: "Avionics & Configuration", order: 1 }),
      field({ key: "ballisticParachuteInstalled", label: "Ballistic Parachute Installed", type: "boolean", defaultValue: false, group: "Avionics & Configuration", order: 2 }),
      field({ key: "weightBalanceUpdated", label: "Last Weight & Balance Update", type: "date", group: "Avionics & Configuration", order: 3 }),
      field({ key: "homeAirport", label: "Home Airport", type: "string", group: "Operations & Support", order: 0 }),
      field({ key: "hangarOrTiedown", label: "Storage Type", type: "select", options: ["hangar", "tie-down", "shared hangar", "shop"], group: "Operations & Support", order: 1 }),
      field({ key: "phaseOneCompleted", label: "Phase I Flight Test Complete", type: "boolean", defaultValue: true, group: "Operations & Support", order: 2 }),
      field({ key: "conditionInspector", label: "Typical Condition Inspector", type: "string", group: "Operations & Support", order: 3 })
    ],
    metricTemplates: [
      metric({ key: "hobbs_hours", name: "Hobbs Hours", unit: "hours", startingValue: 0, helpText: "Useful for routine service intervals on engines and accessories." }),
      metric({ key: "tach_hours", name: "Tach Hours", unit: "hours", startingValue: 0, helpText: "Useful for engine reserve planning where applicable." }),
      metric({ key: "landing_cycles", name: "Landing Cycles", unit: "landings", startingValue: 0, allowManualEntry: true, helpText: "Useful for brakes, gear, and field-use tracking." })
    ],
    scheduleTemplates: [
      schedule({ key: "condition_inspection", name: "Yearly Condition Inspection", description: "Experimental amateur-built aircraft do not receive a standard-category annual inspection. They require a yearly condition inspection signed by an appropriately authorized person. Missing it grounds the airplane.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 45 }, notificationConfig: aircraftGroundingNotification(45), tags: ["regulatory", "inspection", "experimental"] }),
      schedule({ key: "operating_limitations_review", name: "Operating Limitations Review", description: "Experimental aircraft live by their operating limitations as much as by the airworthiness certificate. Review them yearly so fueling, passenger carriage, aerobatic, and maintenance signoff assumptions stay current.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "documentation", "experimental"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Registration still expires on the same legal cycle as standard-category aircraft.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification", description: "Track if the aircraft is so equipped and operated where it is required.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check", description: "Track for IFR-capable experimental aircraft or when the equipment and operation require it.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "firewall_forward_inspection", name: "Firewall-Forward Inspection", description: "Track hoses, clamps, wiring, engine mounts, baffling, and exhaust together because experimental airplanes often vary widely in how these systems were built and routed.", triggerTemplate: { type: "compound", intervalDays: 180, metricKey: "hobbs_hours", intervalValue: 100, logic: "whichever_first", leadTimeDays: 21, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21, upcomingLeadValue: 10 }), tags: ["engine", "firewall forward", "inspection"] }),
      schedule({ key: "fuel_hose_ageout", name: "Fuel, Oil, and Fire-Sleeved Hose Age-Out Review", description: "Many experimentals depend on custom hose routing and nonstandard component sourcing. Rubber hose life needs deliberate calendar tracking.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 90 }), tags: ["engine", "hoses", "age-out"] }),
      schedule({ key: "ignition_system_inspection", name: "Ignition System Inspection", description: "Electronic ignition, magnetos, or mixed systems all have different failure modes. Track the installed ignition intentionally rather than assuming certified-aircraft defaults fit.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["engine", "ignition", "experimental"] }),
      schedule({ key: "weight_balance_review", name: "Weight and Balance Review", description: "Experimental aircraft change frequently. Treat weight-and-balance review as a recurring configuration-control task so modifications do not silently invalidate loading assumptions.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["configuration", "records", "safety"] }),
      schedule({ key: "efis_backup_export", name: "EFIS Configuration Backup and Software Baseline", description: "Back up EFIS, engine monitor, autopilot, and panel settings so a failed display or software update does not leave you rebuilding a custom panel from memory.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["avionics", "configuration", "backup"] }),
      schedule({ key: "prop_bolt_torque_review", name: "Propeller Bolt Torque and Hub Review", description: "Especially important for composite, ground-adjustable, or owner-installed propellers where manufacturer service guidance may not look like certified-aircraft norms.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["propeller", "inspection", "experimental"] }),
      schedule({ key: "ballistic_parachute_repack", name: "Ballistic Parachute Repack / Rocket Service", description: "If the aircraft carries a ballistic recovery system, the repack and rocket dates are hard calendar events with real operational consequences.", triggerTemplate: { type: "interval", intervalDays: 2190, leadTimeDays: 180 }, notificationConfig: aircraftPlanningNotification(180, 0), tags: ["safety", "parachute", "major"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "Experimental coverage can depend heavily on total time, transition training, and builder documentation. Start early.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "ad_compliance_review", name: "AD and Safety Directive Review", description: "Experimental aircraft are not directly subject to ADs, but engine and propeller ADs often still apply if using certified components. Review annually.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries carry a manufacturer-stamped expiration. Track this independently from the annual ELT inspection.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, and expiration date on the cabin fire extinguisher.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] })
    ]
  }),
  libraryPreset({
    key: "aircraft-light-sport",
    label: "Light Sport Aircraft (LSA)",
    category: "aircraft",
    description: "A profile for Special Light-Sport Aircraft (S-LSA) and Experimental Light-Sport Aircraft (E-LSA) that reflects the distinct maintenance, inspection, and operational requirements of the light sport category. Covers the annual condition inspection framework, Rotax engine service cadence, airframe and fabric care, and the regulatory items that differ from standard-category aircraft.",
    tags: ["aircraft", "aviation", "light sport", "LSA", "sport pilot"],
    suggestedCustomFields: [
      field({ key: "nNumber", label: "N-Number (Tail Number)", type: "string", required: true, placeholder: "N123LS", group: "Registration & Airframe", order: 0 }),
      field({ key: "aircraftSerial", label: "Aircraft Serial Number", type: "string", group: "Registration & Airframe", order: 1 }),
      field({ key: "year", label: "Year", type: "number", group: "Registration & Airframe", order: 2 }),
      field({ key: "make", label: "Manufacturer", type: "string", placeholder: "CubCrafters", group: "Registration & Airframe", order: 3 }),
      field({ key: "model", label: "Model", type: "string", placeholder: "Carbon Cub SS", group: "Registration & Airframe", order: 4 }),
      field({ key: "airworthinessBasis", label: "Airworthiness Basis", type: "select", options: ["S-LSA", "E-LSA", "experimental light-sport", "other"], group: "Registration & Airframe", order: 5 }),
      field({ key: "maxGrossWeight", label: "Max Gross Weight", type: "number", unit: "lbs", helpText: "1,320 lbs max for land aircraft, 1,430 lbs for seaplane-configured LSA.", group: "Registration & Airframe", order: 6 }),
      field({ key: "airframeMaterial", label: "Airframe Material", type: "select", options: ["metal", "composite", "tube and fabric", "mixed"], group: "Registration & Airframe", order: 7 }),
      field({ key: "engineMake", label: "Engine Manufacturer", type: "string", placeholder: "Rotax", group: "Powerplant", order: 0 }),
      field({ key: "engineModel", label: "Engine Model", type: "string", placeholder: "912 ULS", group: "Powerplant", order: 1 }),
      field({ key: "engineSerial", label: "Engine Serial Number", type: "string", group: "Powerplant", order: 2 }),
      field({ key: "engineTbo", label: "Engine TBO (hours)", type: "number", helpText: "Rotax 912 series TBO is typically 2,000 hours. Check the latest Rotax service instructions for your specific engine variant.", group: "Powerplant", order: 3 }),
      field({ key: "engineTsmoh", label: "Engine TSMOH", type: "number", helpText: "Time since major overhaul in hours.", group: "Powerplant", order: 4 }),
      field({ key: "gearboxType", label: "Gearbox Type", type: "select", options: ["integral reduction", "belt reduction", "direct drive", "other"], helpText: "Rotax 912/914 use an integral reduction gearbox with its own oil and service interval. Direct-drive engines like Jabiru and Continental do not have a separate gearbox.", group: "Powerplant", order: 5 }),
      field({ key: "fuelType", label: "Fuel Type", type: "select", options: ["100LL", "UL94", "autogas / mogas", "ethanol-free mogas", "other"], group: "Powerplant", order: 6 }),
      field({ key: "efisSuite", label: "EFIS Suite", type: "string", placeholder: "Dynon, Garmin, MGL, etc.", group: "Avionics & Safety", order: 0 }),
      field({ key: "adsbOutCompliant", label: "ADS-B Out Compliant", type: "boolean", defaultValue: true, group: "Avionics & Safety", order: 1 }),
      field({ key: "ballisticParachuteInstalled", label: "Ballistic Parachute Installed", type: "boolean", defaultValue: false, helpText: "Common on Cirrus SR20 LSA-class and some CubCrafters models.", group: "Avionics & Safety", order: 2 }),
      field({ key: "transponderInstalled", label: "Transponder Installed", type: "boolean", defaultValue: true, group: "Avionics & Safety", order: 3 }),
      field({ key: "homeAirport", label: "Home Airport", type: "string", placeholder: "KICT", group: "Operations & Support", order: 0 }),
      field({ key: "hangarOrTiedown", label: "Storage Type", type: "select", options: ["hangar", "tie-down", "T-hangar", "shared hangar"], group: "Operations & Support", order: 1 }),
      field({ key: "insuranceProvider", label: "Insurance Provider", type: "string", group: "Operations & Support", order: 2 }),
      field({ key: "maintenanceProvider", label: "Maintenance Provider", type: "string", helpText: "LSA maintenance may be performed by an LSRM certificate holder, the manufacturer's authorized service center, or a certificated A&P. Track who performs your maintenance here.", group: "Operations & Support", order: 3 }),
      field({ key: "lsrmCertificateHolder", label: "LSRM Certificate Holder", type: "string", helpText: "If an LSRM performs your condition inspection and maintenance, record the certificate holder's name here.", group: "Operations & Support", order: 4 })
    ],
    metricTemplates: [
      metric({ key: "hobbs_hours", name: "Hobbs Hours", unit: "hours", startingValue: 0, helpText: "General-purpose flight time metric for service intervals." }),
      metric({ key: "tach_hours", name: "Tach Hours", unit: "hours", startingValue: 0, helpText: "Engine RPM-based time for overhaul and gearbox service planning." }),
      metric({ key: "landing_cycles", name: "Landing Cycles", unit: "landings", startingValue: 0, allowManualEntry: true, helpText: "Relevant for tire, brake, and landing gear service tracking." })
    ],
    scheduleTemplates: [
      schedule({ key: "condition_inspection", name: "Annual Condition Inspection", description: "Light Sport Aircraft require an annual condition inspection rather than a standard 14 CFR 91.409 annual. The inspection may be performed by an LSRM, the manufacturer's authorized service center, or an A&P/IA. Missing it grounds the airplane.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 45 }, notificationConfig: aircraftGroundingNotification(45), tags: ["regulatory", "inspection", "annual"] }),
      schedule({ key: "registration_renewal", name: "FAA Registration Renewal", description: "Registration still expires on the standard three-year cycle.", triggerTemplate: { type: "interval", intervalDays: 1095, leadTimeDays: 90 }, notificationConfig: aircraftGroundingNotification(90), tags: ["regulatory", "ownership"] }),
      schedule({ key: "transponder_check", name: "Transponder Certification", description: "Required biennial check for transponder-equipped aircraft operating in controlled airspace.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "avionics", "inspection"] }),
      schedule({ key: "pitot_static_check", name: "Pitot-Static & Altimeter Check", description: "Track for IFR-capable LSA or when required by airspace.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 60 }, notificationConfig: aircraftGroundingNotification(60), tags: ["regulatory", "instruments", "inspection"] }),
      schedule({ key: "elt_inspection", name: "ELT Inspection", description: "Annual ELT inspection covering operational check, battery condition, and mounting integrity.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: aircraftGroundingNotification(30), tags: ["regulatory", "safety", "elt"] }),
      schedule({ key: "elt_battery_replacement", name: "ELT Battery Replacement", description: "ELT batteries have a hard expiration date stamped by the manufacturer. Replace on schedule regardless of ELT operational status.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 90 }, notificationConfig: aircraftPlanningNotification(90, 0), tags: ["safety", "elt", "battery"] }),
      schedule({ key: "oil_change", name: "Engine Oil and Filter Change", description: "Rotax 912/914 series engines use a 100-hour or 12-month oil change interval. Non-Rotax engines may differ. Adjust to match your engine manufacturer's recommendations.", triggerTemplate: { type: "compound", intervalDays: 365, metricKey: "hobbs_hours", intervalValue: 100, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 10 }), tags: ["engine", "fluids", "oil"] }),
      schedule({ key: "gearbox_oil_change", name: "Gearbox Oil Change (Rotax)", description: "Rotax integral reduction gearboxes have their own oil system and a dedicated service interval. Skip this schedule for direct-drive engines.", triggerTemplate: { type: "compound", intervalDays: 365, metricKey: "hobbs_hours", intervalValue: 200, logic: "whichever_first", leadTimeDays: 21, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21, upcomingLeadValue: 20 }), tags: ["engine", "gearbox", "rotax"] }),
      schedule({ key: "carburetor_sync", name: "Carburetor Synchronization Check", description: "Dual-carburetor Rotax engines benefit from periodic synchronization checks. Skip for fuel-injected variants.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 200, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 20 }), tags: ["engine", "carburetor", "rotax"] }),
      schedule({ key: "spark_plug_service", name: "Spark Plug Inspection and Service", description: "Inspect, clean, gap, and rotate plugs. Rotax engines are sensitive to plug condition and fouling.", triggerTemplate: { type: "usage", metricKey: "hobbs_hours", intervalValue: 100, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 10 }), tags: ["engine", "ignition"] }),
      schedule({ key: "coolant_service", name: "Coolant System Service (Liquid-Cooled)", description: "Rotax 912/914/915 are liquid-cooled engines. Inspect hoses, clamps, coolant level, and condition. Replace coolant per manufacturer interval. Skip for air-cooled engines.", triggerTemplate: { type: "interval", intervalDays: 730, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["engine", "cooling", "rotax"] }),
      schedule({ key: "rubber_replacement", name: "Rubber Component Replacement Review", description: "Rotax service instructions call for replacement of critical rubber components (fuel hoses, coolant hoses, intake ducts) at defined calendar intervals regardless of appearance. Calendar age matters as much as condition for these items.", triggerTemplate: { type: "interval", intervalDays: 1825, leadTimeDays: 120 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 120 }), tags: ["engine", "hoses", "age-out"] }),
      schedule({ key: "compression_check", name: "Compression Check", description: "Annual compression check to trend cylinder health.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["engine", "inspection", "cylinders"] }),
      schedule({ key: "engine_overhaul_planning", name: "Engine TBO / Overhaul Planning", description: "Track the overhaul horizon as a planning event. Rotax 912 series TBO is 2,000 hours. Plan for shop lead time and logistics well before the limit.", triggerTemplate: { type: "compound", intervalDays: 4380, metricKey: "tach_hours", intervalValue: 2000, logic: "whichever_first", leadTimeDays: 180, leadTimeValue: 200 }, notificationConfig: aircraftPlanningNotification(180, 200), tags: ["engine", "overhaul", "major"] }),
      schedule({ key: "propeller_inspection", name: "Propeller Inspection", description: "Inspect propeller for nicks, delamination, leading edge erosion, and bolt torque. Composite and ground-adjustable props are common on LSA and have specific inspection guidance.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["propeller", "inspection"] }),
      schedule({ key: "tire_brake_inspection", name: "Tire and Brake Inspection", description: "Track by landing cycles so wear does not surprise you away from home base.", triggerTemplate: { type: "usage", metricKey: "landing_cycles", intervalValue: 200, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 20 }), tags: ["airframe", "brakes", "tires"] }),
      schedule({ key: "battery_service", name: "Aircraft Battery Service", description: "Check battery capacity, terminals, and charge state. Weak batteries can cascade into electrical and starting issues.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["electrical", "battery"] }),
      schedule({ key: "fire_extinguisher_inspection", name: "Fire Extinguisher Inspection", description: "Verify gauge, pin, condition, and expiration date. Required safety equipment.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30 }), tags: ["safety", "fire extinguisher"] }),
      schedule({ key: "ballistic_parachute_repack", name: "Ballistic Parachute Repack / Rocket Service", description: "If the aircraft carries a ballistic recovery system, the repack and rocket expiration are hard calendar events. Skip if not installed.", triggerTemplate: { type: "interval", intervalDays: 2190, leadTimeDays: 180 }, notificationConfig: aircraftPlanningNotification(180, 0), tags: ["safety", "parachute", "major"] }),
      schedule({ key: "ad_compliance_review", name: "Airworthiness Directive Compliance Review", description: "Periodically review all applicable ADs, manufacturer service bulletins, and safety directives to confirm continued compliance. S-LSA are subject to manufacturer safety directives rather than traditional FAA ADs.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 30 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 30, overdueCadenceDays: 14, maxOverdueNotifications: 4 }), tags: ["regulatory", "AD", "compliance"] }),
      schedule({ key: "manufacturer_service_bulletin_review", name: "Manufacturer Service Bulletin Review", description: "LSA manufacturers issue service bulletins and safety directives with varying levels of mandatory compliance. Check the manufacturer's bulletin registry at least annually.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["regulatory", "service bulletin", "manufacturer"] }),
      schedule({ key: "fabric_covering_inspection", name: "Fabric Covering Inspection", description: "If the aircraft uses fabric covering, inspect for UV degradation, punch-test condition, and re-coating needs. Skip for metal or composite airframes.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["airframe", "fabric", "inspection"] }),
      schedule({ key: "inactivity_corrosion_prevention", name: "Fly or Preserve (Corrosion Prevention)", description: "If the airplane sits for 30 days, either fly it to full oil temperature or take preservation steps. Short runs and hand-turning do not solve the corrosion problem.", triggerTemplate: { type: "interval", intervalDays: 30, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7, overdueCadenceDays: 7, maxOverdueNotifications: 3 }), tags: ["engine", "corrosion", "inactivity"] }),
      schedule({ key: "insurance_renewal", name: "Aircraft Insurance Renewal", description: "LSA coverage can depend on total time, transition training, and specific make/model loss history. Start the renewal process early.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 60, overdueCadenceDays: 7, maxOverdueNotifications: 6 }), tags: ["ownership", "insurance", "legal"] }),
      schedule({ key: "winter_prep", name: "Winterization and Cold Weather Prep", description: "Prepare preheat hardware, winter oil weight if applicable, battery health, and storage considerations before cold weather arrives.", triggerTemplate: { type: "seasonal", month: 10, day: 15, leadTimeDays: 21 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21 }), tags: ["seasonal", "winter"] }),
      schedule({ key: "spring_prep", name: "Spring Season Prep and First Flight", description: "Do a thorough first-flight inspection after winter storage, including bird nest checks, pitot and vent blockage, fuel contamination, and a slow walk-around before the first flight of the season.", triggerTemplate: { type: "seasonal", month: 3, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["seasonal", "spring"] }),
      schedule({ key: "hangar_tiedown_renewal", name: "Hangar or Tie-Down Lease Renewal", description: "Track the storage arrangement as an operational dependency.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 60 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 60 }), tags: ["ownership", "storage"] })
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
    key: "lawn-mower-maintenance",
    label: "Lawn Mower Maintenance",
    category: "yard",
    description: "A dedicated maintenance profile for push mowers, self-propelled mowers, riding mowers, and zero-turn mowers with engine service, deck care, drive system checks, blade tracking, and seasonal prep schedules.",
    tags: ["yard", "mower", "lawn", "seasonal"],
    suggestedCustomFields: [
      field({ key: "mowerType", label: "Mower Type", type: "select", options: ["push", "self-propelled", "riding", "zero-turn", "robotic", "reel"] }),
      field({ key: "brand", label: "Brand", type: "string" }),
      field({ key: "model", label: "Model", type: "string" }),
      field({ key: "powerType", label: "Power Type", type: "select", options: ["gas 4-stroke", "gas 2-stroke", "battery", "electric corded", "diesel"] }),
      field({ key: "deckSize", label: "Deck Size", type: "string", placeholder: "42 inch" }),
      field({ key: "engineDisplacement", label: "Engine Displacement", type: "string", placeholder: "190cc" }),
      field({ key: "oilType", label: "Oil Type", type: "string", placeholder: "SAE 30" }),
      field({ key: "sparkPlugNumber", label: "Spark Plug Number", type: "string" }),
      field({ key: "bladePartNumber", label: "Blade Part Number", type: "string" }),
      field({ key: "driveType", label: "Drive Type", type: "select", options: ["manual push", "belt drive", "hydrostatic", "electric drive"] }),
      field({ key: "storageLocation", label: "Storage Location", type: "string" }),
      field({ key: "purchaseDate", label: "Purchase Date", type: "date" })
    ],
    metricTemplates: [
      metric({ key: "runtime_hours", name: "Runtime Hours", unit: "hours", startingValue: 0 })
    ],
    scheduleTemplates: [
      schedule({ key: "oil_change", name: "Oil change", description: "Track the most common gas mower service item on both runtime and calendar intervals so infrequent seasonal use does not hide overdue oil.", triggerTemplate: { type: "compound", intervalDays: 180, metricKey: "runtime_hours", intervalValue: 50, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 5 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 5 }), tags: ["engine", "fluids"], quickLogLabel: "Oil changed" }),
      schedule({ key: "air_filter_service", name: "Air filter service", description: "Mowers ingest dust, pollen, and grass clippings fast. This keeps filter cleaning or replacement from slipping until the engine starts running rich.", triggerTemplate: { type: "compound", intervalDays: 90, metricKey: "runtime_hours", intervalValue: 25, logic: "whichever_first", leadTimeDays: 14, leadTimeValue: 3 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14, upcomingLeadValue: 3 }), tags: ["engine", "filters"] }),
      schedule({ key: "spark_plug_replacement", name: "Spark plug replacement", description: "Replace the plug on a real schedule instead of waiting for rough starts, misfires, or spring no-start troubleshooting.", triggerTemplate: { type: "compound", intervalDays: 365, metricKey: "runtime_hours", intervalValue: 100, logic: "whichever_first", leadTimeDays: 21, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21, upcomingLeadValue: 10 }), tags: ["engine", "ignition"] }),
      schedule({ key: "blade_service", name: "Blade sharpening or replacement", description: "Dull blades tear grass, stress the engine, and make the lawn look bad before most owners realize what changed.", triggerTemplate: { type: "usage", metricKey: "runtime_hours", intervalValue: 22.5, leadTimeValue: 3 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 3 }), tags: ["deck", "cutting"] }),
      schedule({ key: "deck_cleaning", name: "Deck cleaning and scraping", description: "Packed grass under the deck hurts airflow, cut quality, and deck life. This is one of the easiest high-value mower-specific tasks to miss.", triggerTemplate: { type: "compound", intervalDays: 30, metricKey: "runtime_hours", intervalValue: 10, logic: "whichever_first", leadTimeDays: 5, leadTimeValue: 2 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 5, upcomingLeadValue: 2, overdueCadenceDays: 7 }), tags: ["deck", "cleaning"] }),
      schedule({ key: "drive_belt_inspection", name: "Drive belt inspection", description: "Relevant to self-propelled, riding, and zero-turn units. Belt wear usually shows up first as weak drive engagement or inconsistent ground speed.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["drive", "wear items"] }),
      schedule({ key: "tire_pressure_check", name: "Tire pressure check", description: "Uneven tire pressure is a common cause of uneven cuts on riding and zero-turn mowers, even when the blades are fine.", triggerTemplate: { type: "interval", intervalDays: 90, leadTimeDays: 7 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 7 }), tags: ["tires"] }),
      schedule({ key: "hydrostatic_transmission_fluid", name: "Hydrostatic transmission fluid", description: "Longer-horizon service for hydrostatic machines where fluid condition directly affects drive feel, heat, and long-term transmission life.", triggerTemplate: { type: "compound", intervalDays: 730, metricKey: "runtime_hours", intervalValue: 200, logic: "whichever_first", leadTimeDays: 30, leadTimeValue: 20 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 30, upcomingLeadValue: 20, overdueCadenceDays: 30 }), tags: ["drive", "fluids"] }),
      schedule({ key: "grease_fittings", name: "Grease fittings and pivot points", description: "Track grease zerks and pivot points on spindles, steering linkages, and front axles before wear starts showing up as slop or noisy operation.", triggerTemplate: { type: "usage", metricKey: "runtime_hours", intervalValue: 25, leadTimeValue: 3 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadValue: 3 }), tags: ["lubrication"] }),
      schedule({ key: "battery_maintenance", name: "Battery maintenance", description: "Covers both starting batteries on riding mowers and storage care for battery-powered units between heavy-use periods.", triggerTemplate: { type: "interval", intervalDays: 180, leadTimeDays: 14 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 14 }), tags: ["electrical"] }),
      schedule({ key: "fuel_stabilizer", name: "Fuel stabilizer or fuel drain (winterization)", description: "Do this before storage so stale fuel, varnish, and hard spring starts do not turn into preventable carburetor cleanup.", triggerTemplate: { type: "seasonal", month: 10, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 14, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["seasonal", "fuel", "storage"] }),
      schedule({ key: "spring_prep", name: "Spring pre-season prep", description: "Commission the mower for the season with a full pre-use review: fluids, battery health, blades, tire pressure, and safety interlocks.", triggerTemplate: { type: "seasonal", month: 3, day: 15, leadTimeDays: 14 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 14, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["seasonal", "commissioning"] }),
      schedule({ key: "safety_feature_inspection", name: "Safety feature inspection", description: "Verify blade brake, operator-presence controls, discharge guards, shields, and interlocks before a failed safety system becomes an injury problem.", triggerTemplate: { type: "interval", intervalDays: 365, leadTimeDays: 21 }, notificationConfig: notification({ channels: ["push", "email", "digest"], digest: true, upcomingLeadDays: 21, overdueCadenceDays: 7, maxOverdueNotifications: 4 }), tags: ["safety"] }),
      schedule({ key: "fuel_filter_replacement", name: "Fuel filter replacement", description: "Many riding mowers and larger gas units have a separate inline fuel filter that quietly creates drivability issues when ignored.", triggerTemplate: { type: "compound", intervalDays: 365, metricKey: "runtime_hours", intervalValue: 100, logic: "whichever_first", leadTimeDays: 21, leadTimeValue: 10 }, notificationConfig: notification({ ...standardPushDigest, upcomingLeadDays: 21, upcomingLeadValue: 10 }), tags: ["engine", "filters", "fuel"] })
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