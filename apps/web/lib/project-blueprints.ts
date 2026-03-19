import type {
  CreateProjectBudgetCategoryInput,
  CreateProjectNoteInput,
  CreateProjectPhaseSupplyInput,
  CreateProjectTaskChecklistItemInput,
  CreateProjectTaskInput,
  NoteCategory,
  ProjectStatus,
  ProjectTaskStatus
} from "@lifekeeper/types";

type BlueprintFamily = "Home & Operations" | "Event Planning";

type BlueprintSeedPhase = {
  key: string;
  name: string;
  description?: string;
  notes?: string;
  startDaysBeforeTarget?: number;
  targetDaysBeforeTarget?: number;
  checklist?: string[];
};

type BlueprintSeedTask = {
  key: string;
  phaseKey?: string;
  title: string;
  description?: string;
  status?: ProjectTaskStatus;
  taskType?: "quick" | "full";
  estimatedHours?: number;
  estimatedCost?: number;
  dueDaysBeforeTarget?: number;
  checklist?: Array<CreateProjectTaskChecklistItemInput["title"]>;
  predecessorKeys?: string[];
};

type BlueprintSeedSupply = Omit<CreateProjectPhaseSupplyInput, "isProcured" | "isStaged"> & {
  phaseKey: string;
  isProcured?: boolean;
  isStaged?: boolean;
};

type BlueprintSeedNote = Pick<CreateProjectNoteInput, "title" | "body" | "category"> & {
  isPinned?: boolean;
};

type BlueprintSeed = {
  phases: BlueprintSeedPhase[];
  tasks: BlueprintSeedTask[];
  budgetCategories: CreateProjectBudgetCategoryInput[];
  supplies: BlueprintSeedSupply[];
  notes: BlueprintSeedNote[];
};

type BlueprintBase = {
  key: string;
  label: string;
  family: BlueprintFamily;
  description: string;
  status: ProjectStatus;
  scopeSummary: string;
  executionNotes: string;
  checklist: string[];
  suggestedPhases: string[];
  featuredTools: string[];
  venueFocus: string[];
  inspirationPrompts: string[];
};

export type ManualProjectBlueprint = BlueprintBase & {
  kind: "manual";
};

export type SeededProjectBlueprint = BlueprintBase & {
  kind: "seeded";
  seed: BlueprintSeed;
};

export type ProjectBlueprint = ManualProjectBlueprint | SeededProjectBlueprint;

const buildSeededBlueprint = (
  blueprint: Omit<SeededProjectBlueprint, "suggestedPhases"> & { suggestedPhases?: string[] }
): SeededProjectBlueprint => ({
  ...blueprint,
  suggestedPhases: blueprint.suggestedPhases ?? blueprint.seed.phases.map((phase) => phase.name)
});

const generalEventPlanningSeed: BlueprintSeed = {
  phases: [
    {
      key: "brief",
      name: "Event Brief & Feasibility",
      description: "Clarify the purpose, target headcount, budget guardrails, and success measures before any bookings.",
      startDaysBeforeTarget: 120,
      targetDaysBeforeTarget: 105,
      checklist: [
        "Define the purpose and tone of the event",
        "Set a working headcount range for venue sizing",
        "Record budget ceiling, contingency, and non-negotiables"
      ]
    },
    {
      key: "venue",
      name: "Venue & Space Planning",
      description: "Evaluate venue fit, layout, capacity, accessibility, power, parking, and flow between activity zones.",
      startDaysBeforeTarget: 105,
      targetDaysBeforeTarget: 75,
      checklist: [
        "Compare venue capacity against target and stretch headcount",
        "Document seating, standing, staging, and service footprints",
        "Capture rain, backup, or overflow plan"
      ]
    },
    {
      key: "vendors",
      name: "Vendors, Rentals & Procurement",
      description: "Track suppliers, rentals, decor, food service, production support, and key booking decisions.",
      startDaysBeforeTarget: 90,
      targetDaysBeforeTarget: 35,
      checklist: [
        "Build vendor shortlists by category",
        "Track rental lead times and pickup windows",
        "Convert missing materials into supply lines"
      ]
    },
    {
      key: "experience",
      name: "Experience Design",
      description: "Translate inspiration into concrete environment, signage, seating density, and run-of-show decisions.",
      startDaysBeforeTarget: 60,
      targetDaysBeforeTarget: 18,
      checklist: [
        "Lock layout concept and guest flow",
        "Finalize decor, signage, and table needs",
        "Capture setup visuals and references"
      ]
    },
    {
      key: "production",
      name: "Production Week",
      description: "Confirm arrivals, staging order, load-in sequence, contingency kits, and onsite ownership.",
      startDaysBeforeTarget: 14,
      targetDaysBeforeTarget: 1,
      checklist: [
        "Confirm every booking, delivery, and pickup window",
        "Stage event-day supplies by zone",
        "Prepare day-of troubleshooting kit"
      ]
    },
    {
      key: "event-day",
      name: "Event Day & Wrap-Up",
      description: "Manage execution, reset tasks, damage checks, teardown, and note improvements for next time.",
      startDaysBeforeTarget: 0,
      targetDaysBeforeTarget: 0,
      checklist: [
        "Assign setup, host, and teardown owners",
        "Capture spending deltas and incident notes",
        "Log lessons learned while details are fresh"
      ]
    }
  ],
  tasks: [
    {
      key: "event-brief",
      phaseKey: "brief",
      title: "Write the event brief",
      description: "Define occasion, audience, headcount band, tone, and constraints.",
      estimatedHours: 2,
      dueDaysBeforeTarget: 112,
      checklist: ["Purpose", "Guest-count range", "Budget cap", "Success criteria"]
    },
    {
      key: "space-needs",
      phaseKey: "venue",
      title: "Model venue capacity and layout needs",
      description: "Estimate seated, standing, service, staging, and circulation requirements from expected guest count.",
      estimatedHours: 3,
      dueDaysBeforeTarget: 96,
      predecessorKeys: ["event-brief"],
      checklist: ["Seating density", "Accessibility", "Weather backup", "Parking or arrival flow"]
    },
    {
      key: "vendor-shortlist",
      phaseKey: "vendors",
      title: "Build vendor and rental shortlist",
      estimatedHours: 4,
      dueDaysBeforeTarget: 72,
      predecessorKeys: ["space-needs"],
      checklist: ["Food / beverage", "Rentals", "Decor", "Production support"]
    },
    {
      key: "experience-board",
      phaseKey: "experience",
      title: "Translate inspiration into a buildable environment plan",
      estimatedHours: 3,
      dueDaysBeforeTarget: 30,
      predecessorKeys: ["vendor-shortlist"],
      checklist: ["Color and mood references", "Tabletop or zone concept", "Signage requirements", "Photo moments"]
    },
    {
      key: "production-runbook",
      phaseKey: "production",
      title: "Assemble the production runbook",
      estimatedHours: 2,
      dueDaysBeforeTarget: 4,
      predecessorKeys: ["experience-board"],
      checklist: ["Delivery windows", "Setup order", "Contact list", "Fallback plan"]
    },
    {
      key: "closeout-review",
      phaseKey: "event-day",
      title: "Capture closeout notes and reset actions",
      estimatedHours: 1,
      dueDaysBeforeTarget: 0,
      predecessorKeys: ["production-runbook"],
      checklist: ["Damage check", "Return items", "Budget update", "Lessons learned"]
    }
  ],
  budgetCategories: [
    { name: "Venue", sortOrder: 0 },
    { name: "Food & Beverage", sortOrder: 1 },
    { name: "Rentals", sortOrder: 2 },
    { name: "Decor & Styling", sortOrder: 3 },
    { name: "Production & AV", sortOrder: 4 },
    { name: "Staffing", sortOrder: 5 },
    { name: "Contingency", sortOrder: 6 }
  ],
  supplies: [
    { phaseKey: "experience", name: "Layout sketches / printouts", quantityNeeded: 1, quantityOnHand: 0, unit: "set", notes: "Annotated floor plan, guest flow, and service zones." },
    { phaseKey: "experience", name: "Reference swatches / mood board materials", quantityNeeded: 1, quantityOnHand: 0, unit: "set" },
    { phaseKey: "production", name: "Signage and holders", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "production", name: "Extension cords and power strips", quantityNeeded: 4, quantityOnHand: 0, unit: "each" },
    { phaseKey: "production", name: "Day-of emergency kit", quantityNeeded: 1, quantityOnHand: 0, unit: "kit" }
  ],
  notes: [
    {
      title: "Event brief",
      category: "general",
      isPinned: true,
      body: "Document the purpose, ideal atmosphere, target guest-count band, venue constraints, and what a successful event should feel like. Keep it practical and tied to space, supplies, and execution."
    },
    {
      title: "Venue fit worksheet",
      category: "reference",
      isPinned: true,
      body: "Track the target headcount range, seated vs standing assumptions, required zones, accessibility needs, and the fallback plan if attendance exceeds expectations."
    },
    {
      title: "Inspiration and references",
      category: "research",
      body: "Collect links, screenshots, material ideas, layout concepts, lighting references, floral direction, signage concepts, and any setup details worth replicating."
    },
    {
      title: "Vendor tracker notes",
      category: "decision",
      body: "Use this note to log who is being considered for rentals, food, beverage, decor, production, and teardown support. Capture decision criteria, lead times, and red flags."
    }
  ]
};

const weddingSeed: BlueprintSeed = {
  phases: [
    {
      key: "vision",
      name: "Vision, Budget & Headcount",
      description: "Set the wedding style, financial boundaries, headcount range, and space requirements before commitments lock in.",
      startDaysBeforeTarget: 365,
      targetDaysBeforeTarget: 300,
      checklist: [
        "Define the kind of wedding experience being built",
        "Set target, likely, and max guest-count bands for venue sizing",
        "Record budget ceiling and non-negotiables"
      ]
    },
    {
      key: "venue",
      name: "Venue, Ceremony & Reception Flow",
      description: "Choose a venue that fits the headcount, ceremony plan, reception footprint, and service flow.",
      startDaysBeforeTarget: 320,
      targetDaysBeforeTarget: 240,
      checklist: [
        "Verify ceremony and reception capacities separately",
        "Map cocktail, dining, dance floor, and back-of-house zones",
        "Record weather backup and accessibility plan"
      ]
    },
    {
      key: "vendors",
      name: "Vendors, Contracts & Core Services",
      description: "Book the critical external partners and capture timing, scope, and decision notes.",
      startDaysBeforeTarget: 270,
      targetDaysBeforeTarget: 120,
      checklist: [
        "Shortlist photographer, catering, bar, music, floral, and rentals",
        "Document load-in and strike requirements",
        "Convert open needs into tracked tasks and supply lines"
      ]
    },
    {
      key: "design",
      name: "Design, Decor & Inspiration",
      description: "Turn visual inspiration into concrete tablescape, ceremony, signage, lighting, and material decisions.",
      startDaysBeforeTarget: 210,
      targetDaysBeforeTarget: 45,
      checklist: [
        "Lock floral and decor direction",
        "Finalize table count assumptions from headcount range",
        "Review ceremony backdrop, lounge, and signage zones"
      ]
    },
    {
      key: "food",
      name: "Food, Beverage & Guest Experience",
      description: "Shape the service plan, bar approach, floor logistics, and guest comfort details tied to attendance size.",
      startDaysBeforeTarget: 180,
      targetDaysBeforeTarget: 30,
      checklist: [
        "Estimate service pace against guest count",
        "Confirm table, chair, and place-setting quantities",
        "Document late-night, water, coffee, and comfort stations"
      ]
    },
    {
      key: "attire",
      name: "Attire, Personal Prep & Support Items",
      description: "Manage wardrobe, accessories, storage, steaming, emergency items, and getting-ready supplies.",
      startDaysBeforeTarget: 150,
      targetDaysBeforeTarget: 14,
      checklist: [
        "Track all attire pieces and accessories",
        "Confirm garment transport and storage plan",
        "Assemble repair and comfort kit"
      ]
    },
    {
      key: "production",
      name: "Production Week",
      description: "Confirm all deliveries, rentals, layout counts, staging zones, and day-of handoffs.",
      startDaysBeforeTarget: 10,
      targetDaysBeforeTarget: 1,
      checklist: [
        "Confirm all vendor arrival windows",
        "Stage signage, decor, emergency supplies, and paperwork",
        "Print or save the day-of production plan"
      ]
    },
    {
      key: "wedding-day",
      name: "Wedding Day Operations",
      description: "Run setup, ceremony transitions, reception support, teardown, and return logistics.",
      startDaysBeforeTarget: 0,
      targetDaysBeforeTarget: 0,
      checklist: [
        "Assign zone owners for setup and reset",
        "Track missing items or damage during teardown",
        "Capture post-event returns and follow-up needs"
      ]
    },
    {
      key: "closeout",
      name: "Closeout & Returns",
      description: "Wrap up rentals, reconcile budget, preserve notes, and document what worked.",
      startDaysBeforeTarget: -1,
      targetDaysBeforeTarget: -14,
      checklist: [
        "Confirm rentals and borrowed items are returned",
        "Log final spend and deposits",
        "Capture improvements for future hosting"
      ]
    }
  ],
  tasks: [
    { key: "wedding-brief", phaseKey: "vision", title: "Write the wedding operating brief", dueDaysBeforeTarget: 340, estimatedHours: 3, checklist: ["Mood and tone", "Guest-count bands", "Budget cap", "Must-have experience elements"] },
    { key: "venue-capacity", phaseKey: "venue", title: "Model venue capacity against guest-count scenarios", dueDaysBeforeTarget: 285, estimatedHours: 3, predecessorKeys: ["wedding-brief"], checklist: ["Ceremony seating", "Reception dining", "Dance floor", "Rain or overflow plan"] },
    { key: "venue-walkthrough", phaseKey: "venue", title: "Document ceremony-to-reception flow", dueDaysBeforeTarget: 255, estimatedHours: 2, predecessorKeys: ["venue-capacity"], checklist: ["Arrival path", "Cocktail area", "Vendor staging", "Teardown route"] },
    { key: "photo-shortlist", phaseKey: "vendors", title: "Shortlist photographer and video coverage", dueDaysBeforeTarget: 220, estimatedHours: 2, predecessorKeys: ["venue-walkthrough"] },
    { key: "catering-plan", phaseKey: "vendors", title: "Define catering and bar service needs", dueDaysBeforeTarget: 200, estimatedHours: 3, predecessorKeys: ["venue-capacity"], checklist: ["Service style", "Table count impact", "Bar setup", "Dietary considerations at a count level"] },
    { key: "rental-scope", phaseKey: "vendors", title: "Build rental scope and count assumptions", dueDaysBeforeTarget: 170, estimatedHours: 3, predecessorKeys: ["catering-plan"], checklist: ["Tables", "Chairs", "Linens", "Lounge / specialty pieces"] },
    { key: "design-board", phaseKey: "design", title: "Create the decor and atmosphere board", dueDaysBeforeTarget: 150, estimatedHours: 4, predecessorKeys: ["venue-walkthrough"], checklist: ["Color story", "Floral direction", "Tabletop style", "Signage tone"] },
    { key: "layout-plan", phaseKey: "design", title: "Draft layout and zone plan", dueDaysBeforeTarget: 90, estimatedHours: 3, predecessorKeys: ["rental-scope", "design-board"], checklist: ["Head table or sweetheart", "Guest tables", "Bar and lounge", "Photo moments"] },
    { key: "count-refresh", phaseKey: "food", title: "Refresh count assumptions for catering and rentals", dueDaysBeforeTarget: 45, estimatedHours: 2, predecessorKeys: ["layout-plan"], checklist: ["Best-case count", "Working count", "Stretch count"] },
    { key: "tabletop-review", phaseKey: "food", title: "Review tablescape and service surface needs", dueDaysBeforeTarget: 35, estimatedHours: 2, predecessorKeys: ["count-refresh"] },
    { key: "attire-kit", phaseKey: "attire", title: "Assemble attire support and emergency kit", dueDaysBeforeTarget: 10, estimatedHours: 2, checklist: ["Steamer", "Tape / pins", "Lint tools", "Comfort items"] },
    { key: "signage-pack", phaseKey: "production", title: "Pack signage, printed materials, and holders", dueDaysBeforeTarget: 5, estimatedHours: 2, predecessorKeys: ["layout-plan"] },
    { key: "vendor-confirmations", phaseKey: "production", title: "Confirm all arrival and strike windows", dueDaysBeforeTarget: 4, estimatedHours: 2, predecessorKeys: ["rental-scope", "catering-plan"] },
    { key: "setup-order", phaseKey: "production", title: "Write the setup and reset order", dueDaysBeforeTarget: 3, estimatedHours: 2, predecessorKeys: ["vendor-confirmations", "signage-pack"], checklist: ["Load-in", "Ceremony setup", "Reception reset", "Teardown"] },
    { key: "day-of-zones", phaseKey: "wedding-day", title: "Run setup by zone and owner", dueDaysBeforeTarget: 0, estimatedHours: 5, predecessorKeys: ["setup-order"], checklist: ["Ceremony", "Cocktail", "Reception", "Back-of-house"] },
    { key: "returns-closeout", phaseKey: "closeout", title: "Track returns, damages, and final spend", dueDaysBeforeTarget: -3, estimatedHours: 2, predecessorKeys: ["day-of-zones"], checklist: ["Rental returns", "Borrowed items", "Expense reconciliation", "Lessons learned"] }
  ],
  budgetCategories: [
    { name: "Venue", sortOrder: 0 },
    { name: "Catering", sortOrder: 1 },
    { name: "Bar", sortOrder: 2 },
    { name: "Photography & Video", sortOrder: 3 },
    { name: "Florals & Decor", sortOrder: 4 },
    { name: "Rentals", sortOrder: 5 },
    { name: "Music & Production", sortOrder: 6 },
    { name: "Attire & Prep", sortOrder: 7 },
    { name: "Signage & Paper Goods", sortOrder: 8 },
    { name: "Contingency", sortOrder: 9 }
  ],
  supplies: [
    { phaseKey: "design", name: "Mood board and material swatches", quantityNeeded: 1, quantityOnHand: 0, unit: "set" },
    { phaseKey: "design", name: "Sample table setup pieces", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "food", name: "Table count worksheet", quantityNeeded: 1, quantityOnHand: 0, unit: "sheet" },
    { phaseKey: "production", name: "Signage set and holders", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "production", name: "Extension cords and gaffer tape", quantityNeeded: 1, quantityOnHand: 0, unit: "kit" },
    { phaseKey: "attire", name: "Attire emergency kit", quantityNeeded: 1, quantityOnHand: 0, unit: "kit" },
    { phaseKey: "wedding-day", name: "Hydration and comfort station supplies", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "closeout", name: "Return bins and labels", quantityNeeded: 1, quantityOnHand: 0, unit: "set" }
  ],
  notes: [
    {
      title: "Wedding brief",
      category: "general",
      isPinned: true,
      body: "Record the event tone, headcount bands, venue constraints, top priorities, and what should feel effortless for guests. Keep the focus on space, flow, atmosphere, and operations."
    },
    {
      title: "Venue fit and flow",
      category: "reference",
      isPinned: true,
      body: "Track ceremony capacity, reception seating assumptions, dance floor footprint, service areas, accessibility, weather backup, and teardown path."
    },
    {
      title: "Vendor comparison and decisions",
      category: "decision",
      body: "Capture who is being considered for photography, food, bar, florals, rentals, music, and production support. Note fit, concerns, setup needs, and decision rationale."
    },
    {
      title: "Design references",
      category: "research",
      body: "Store inspiration links, florals, lighting, tabletop concepts, signage ideas, ceremony backdrop references, and room mood examples."
    },
    {
      title: "Production-day runbook",
      category: "general",
      isPinned: true,
      body: "Use this note for the final setup order, key contacts, staging zones, backup plan, and teardown responsibilities."
    }
  ]
};

const corporateEventSeed: BlueprintSeed = {
  phases: [
    { key: "objectives", name: "Goals, Audience & Format", startDaysBeforeTarget: 180, targetDaysBeforeTarget: 140, checklist: ["Define event outcome", "Set attendance band", "Choose format and room style"] },
    { key: "space", name: "Venue & Space Program", startDaysBeforeTarget: 150, targetDaysBeforeTarget: 100, checklist: ["Stage and seating plan", "Breakout needs", "Registration and catering footprint"] },
    { key: "production", name: "Production & Vendors", startDaysBeforeTarget: 120, targetDaysBeforeTarget: 35, checklist: ["AV scope", "Catering plan", "Furniture and signage needs"] },
    { key: "content", name: "Agenda & Experience", startDaysBeforeTarget: 90, targetDaysBeforeTarget: 14, checklist: ["Agenda timing", "Speaker support", "Wayfinding and transitions"] },
    { key: "event-day", name: "Execution & Strike", startDaysBeforeTarget: 0, targetDaysBeforeTarget: 0, checklist: ["Load-in", "Room reset", "Strike plan"] }
  ],
  tasks: [
    { key: "brief", phaseKey: "objectives", title: "Write the event brief", dueDaysBeforeTarget: 155, estimatedHours: 2, checklist: ["Audience", "Goals", "Headcount band", "Format"] },
    { key: "capacity-plan", phaseKey: "space", title: "Size the venue and room program", dueDaysBeforeTarget: 120, estimatedHours: 3, predecessorKeys: ["brief"] },
    { key: "av-scope", phaseKey: "production", title: "Define AV and staging scope", dueDaysBeforeTarget: 75, estimatedHours: 3, predecessorKeys: ["capacity-plan"] },
    { key: "agenda-map", phaseKey: "content", title: "Map agenda to room transitions", dueDaysBeforeTarget: 21, estimatedHours: 2, predecessorKeys: ["av-scope"] },
    { key: "strike-plan", phaseKey: "event-day", title: "Confirm strike and return plan", dueDaysBeforeTarget: 0, estimatedHours: 1, predecessorKeys: ["agenda-map"] }
  ],
  budgetCategories: [
    { name: "Venue", sortOrder: 0 },
    { name: "Production & AV", sortOrder: 1 },
    { name: "Catering", sortOrder: 2 },
    { name: "Furniture & Rentals", sortOrder: 3 },
    { name: "Signage", sortOrder: 4 },
    { name: "Contingency", sortOrder: 5 }
  ],
  supplies: [
    { phaseKey: "production", name: "Stage and room signage", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "production", name: "Power and cable kit", quantityNeeded: 1, quantityOnHand: 0, unit: "kit" },
    { phaseKey: "event-day", name: "Speaker support supplies", quantityNeeded: 1, quantityOnHand: 0, unit: "kit" }
  ],
  notes: [
    { title: "Event objectives", category: "general", isPinned: true, body: "Document the business outcome, audience, attendance band, format, and what the room must support operationally." },
    { title: "Venue program", category: "reference", body: "Track plenary, breakout, catering, registration, backstage, and storage requirements." },
    { title: "Inspiration and references", category: "research", body: "Collect layout ideas, stage looks, registration setups, signage examples, and lounge concepts." }
  ]
};

const milestoneCelebrationSeed: BlueprintSeed = {
  phases: [
    { key: "concept", name: "Concept & Headcount", startDaysBeforeTarget: 90, targetDaysBeforeTarget: 70, checklist: ["Style of gathering", "Attendance band", "Indoor/outdoor assumptions"] },
    { key: "space", name: "Space, Seating & Flow", startDaysBeforeTarget: 75, targetDaysBeforeTarget: 40, checklist: ["Capacity and seating", "Food service zone", "Activity space"] },
    { key: "menu", name: "Menu, Decor & Supplies", startDaysBeforeTarget: 45, targetDaysBeforeTarget: 10, checklist: ["Serving plan", "Decor setup", "Shopping list"] },
    { key: "event-day", name: "Setup, Hosting & Reset", startDaysBeforeTarget: 0, targetDaysBeforeTarget: 0, checklist: ["Setup by zone", "Host flow", "Cleanup plan"] }
  ],
  tasks: [
    { key: "concept-note", phaseKey: "concept", title: "Define the celebration brief", dueDaysBeforeTarget: 78, estimatedHours: 1.5 },
    { key: "space-fit", phaseKey: "space", title: "Check venue fit against guest-count range", dueDaysBeforeTarget: 55, estimatedHours: 2, predecessorKeys: ["concept-note"] },
    { key: "menu-plan", phaseKey: "menu", title: "Finalize service and staging plan", dueDaysBeforeTarget: 18, estimatedHours: 2, predecessorKeys: ["space-fit"] },
    { key: "hosting-kit", phaseKey: "event-day", title: "Stage hosting and cleanup kit", dueDaysBeforeTarget: 0, estimatedHours: 1, predecessorKeys: ["menu-plan"] }
  ],
  budgetCategories: [
    { name: "Venue", sortOrder: 0 },
    { name: "Food & Beverage", sortOrder: 1 },
    { name: "Decor", sortOrder: 2 },
    { name: "Rentals", sortOrder: 3 },
    { name: "Contingency", sortOrder: 4 }
  ],
  supplies: [
    { phaseKey: "menu", name: "Serving and tabletop supplies", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "menu", name: "Decor and signage kit", quantityNeeded: 1, quantityOnHand: 0, unit: "lot" },
    { phaseKey: "event-day", name: "Cleanup and reset supplies", quantityNeeded: 1, quantityOnHand: 0, unit: "kit" }
  ],
  notes: [
    { title: "Celebration brief", category: "general", isPinned: true, body: "Capture tone, attendance band, hosting priorities, venue assumptions, and setup style." },
    { title: "Mood and decor references", category: "research", body: "Collect styling references, tablescape ideas, food presentation ideas, and activity-zone inspiration." }
  ]
};

export const projectBlueprints: ProjectBlueprint[] = [
  {
    kind: "manual",
    key: "renovation",
    family: "Home & Operations",
    label: "Renovation / Improvement",
    description: "For upgrades, remodels, replacements, or larger multi-step improvements tied to a room, building, or system.",
    status: "planning",
    scopeSummary: "Define the area being improved, the target outcome, and any structural, finish, or contractor dependencies.",
    executionNotes: "Capture bid comparisons, permit constraints, lead-time items, finish selections, and any sequencing dependencies across trades.",
    checklist: ["Link affected assets or spaces", "Add procurement-driven inventory lines", "Track outside vendor quotes"],
    suggestedPhases: ["Planning & Permitting", "Demolition & Prep", "Rough-In Work", "Finish Work", "Punch List & Closeout"],
    featuredTools: ["Phases", "Task sequencing", "Supplies", "Budget categories"],
    venueFocus: ["Rooms", "Service access", "Storage staging"],
    inspirationPrompts: ["Finish references", "Material pairings", "Lighting direction"]
  },
  {
    kind: "manual",
    key: "seasonal-maintenance",
    family: "Home & Operations",
    label: "Seasonal Maintenance Push",
    description: "For household-wide preventive maintenance campaigns that happen on a schedule or before a season change.",
    status: "planning",
    scopeSummary: "Bundle the recurring work to prepare equipment, property systems, or vehicles for the next operating season.",
    executionNotes: "Call out consumables, inspection checkpoints, weather windows, and the list of systems that must be closed out before completion.",
    checklist: ["Break work into repeatable tasks", "Reserve common consumables", "Use due dates to pace completion"],
    suggestedPhases: ["Inspection & Assessment", "Parts & Supplies Procurement", "Execution", "Verification & Storage"],
    featuredTools: ["Phases", "Quick todos", "Supplies", "Shopping list"],
    venueFocus: ["Outdoor areas", "Storage locations", "Service zones"],
    inspirationPrompts: ["Inspection checklists", "Season prep notes", "Storage layouts"]
  },
  {
    kind: "manual",
    key: "repair-response",
    family: "Home & Operations",
    label: "Repair / Recovery",
    description: "For corrective work responding to a breakdown, failure, inspection finding, or urgent issue.",
    status: "active",
    scopeSummary: "Describe the fault, the impact, and the definition of done needed to return the asset or system to service.",
    executionNotes: "Track diagnostic findings, temporary mitigations, parts on order, and any safety or downtime considerations until the repair is closed.",
    checklist: ["Document the failure clearly", "Track spent vs estimate closely", "Flag missing parts immediately"],
    suggestedPhases: ["Diagnosis & Scoping", "Parts Procurement", "Repair Execution", "Testing & Verification"],
    featuredTools: ["Tasks", "Expenses", "Notes", "Parts / supplies"],
    venueFocus: ["Affected asset area", "Work staging", "Safety isolation"],
    inspirationPrompts: ["Failure photos", "Repair notes", "Testing checklist"]
  },
  {
    kind: "manual",
    key: "equipment-upgrade",
    family: "Home & Operations",
    label: "Equipment Upgrade",
    description: "For modernization work where hardware, tools, or systems are being replaced or expanded.",
    status: "planning",
    scopeSummary: "Outline what is being upgraded, what capability is changing, and what installation or commissioning steps are required.",
    executionNotes: "Include compatibility checks, retirement or transfer plans for old equipment, and the validation steps needed before cutover.",
    checklist: ["Link old and new assets", "Stage install materials", "Plan testing or commissioning"],
    suggestedPhases: ["Research & Selection", "Procurement & Delivery", "Installation & Configuration", "Commissioning & Validation"],
    featuredTools: ["Assets", "Tasks", "Budget categories", "Supplies"],
    venueFocus: ["Install footprint", "Utility access", "Testing area"],
    inspirationPrompts: ["Rack or layout references", "Cable plans", "Commissioning checklist"]
  },
  {
    kind: "manual",
    key: "vendor-coordination",
    family: "Home & Operations",
    label: "Vendor / Service Coordination",
    description: "For projects centered on outside providers, quotes, scheduling windows, and tracked service spend.",
    status: "planning",
    scopeSummary: "Summarize the contracted scope, the service window, and the external deliverables expected from the provider.",
    executionNotes: "Store provider notes, approval checkpoints, warranty follow-up, and any household prep needed before the vendor arrives.",
    checklist: ["Assign the primary provider", "Track quoted and actual costs", "Capture follow-up and warranty notes"],
    suggestedPhases: ["Scope Definition & Quotes", "Vendor Selection & Scheduling", "Execution & Supervision", "Inspection & Acceptance"],
    featuredTools: ["Expenses", "Notes", "Tasks", "Service providers"],
    venueFocus: ["Work area", "Access constraints", "Cleanup expectations"],
    inspirationPrompts: ["Scope notes", "Quote comparisons", "Acceptance checklist"]
  },
  buildSeededBlueprint({
    kind: "seeded",
    key: "event-planning",
    family: "Event Planning",
    label: "Event Planning Studio",
    description: "A structured event planning preset for venue sizing, supplies, ideas, staging, vendor coordination, and day-of operations.",
    status: "planning",
    scopeSummary: "Start with purpose, headcount range, venue fit, activity zones, and the physical experience being built for guests.",
    executionNotes: "Use notes for inspiration and concept development, budget categories for spending control, supplies for rentals and materials, and tasks to run production week and event day.",
    checklist: ["Model headcount against venue size", "Track rentals and staging supplies", "Keep design inspiration and execution notes together"],
    featuredTools: ["Venue planning", "Supplies and shopping list", "Budget categories", "Inspiration notes"],
    venueFocus: ["Capacity", "Flow", "Activity zones", "Weather backup"],
    inspirationPrompts: ["Layout concepts", "Lighting direction", "Decor references"],
    seed: generalEventPlanningSeed
  }),
  buildSeededBlueprint({
    kind: "seeded",
    key: "event-planning-wedding",
    family: "Event Planning",
    label: "Wedding Mode",
    description: "A comprehensive wedding planning preset focused on venue flow, supplies, decor, vendors, headcount-driven logistics, and day-of operations.",
    status: "planning",
    scopeSummary: "Organize the wedding around guest-count bands, ceremony and reception flow, production logistics, atmosphere, rentals, and practical execution.",
    executionNotes: "Avoid invitation and registry overlap; keep the project centered on the physical event, the operating plan, vendors, supplies, space use, and inspiration tracking.",
    checklist: ["Size venue and table counts from guest-count scenarios", "Track decor, rentals, and staging needs", "Build a production-week and day-of runbook"],
    featuredTools: ["Venue flow", "Decor and inspiration", "Rentals and supplies", "Vendor coordination", "Production day runbook"],
    venueFocus: ["Ceremony layout", "Reception seating", "Dance floor", "Vendor staging", "Weather backup"],
    inspirationPrompts: ["Florals", "Tablescapes", "Lighting", "Signage", "Ceremony backdrop"],
    seed: weddingSeed
  }),
  buildSeededBlueprint({
    kind: "seeded",
    key: "event-planning-corporate",
    family: "Event Planning",
    label: "Corporate Event / Launch",
    description: "A planning preset for launches, internal summits, client events, and speaking programs where room program and production matter.",
    status: "planning",
    scopeSummary: "Focus on audience size, room program, AV, signage, catering, and the practical movement of people through the space.",
    executionNotes: "Use the project to coordinate venue footprint, production support, breakouts, staging, and all physical event dependencies.",
    checklist: ["Translate attendance band into room program", "Track AV and signage requirements", "Build load-in and strike plan"],
    featuredTools: ["Space program", "AV and production", "Supplies", "Run-of-show tasks"],
    venueFocus: ["Plenary room", "Breakouts", "Registration", "Backstage"],
    inspirationPrompts: ["Stage looks", "Lounge areas", "Wayfinding"],
    seed: corporateEventSeed
  }),
  buildSeededBlueprint({
    kind: "seeded",
    key: "event-planning-celebration",
    family: "Event Planning",
    label: "Milestone Celebration",
    description: "A focused preset for birthdays, anniversaries, showers, and other personal gatherings centered on hosting and atmosphere.",
    status: "planning",
    scopeSummary: "Plan around venue size, seating, food service, decor, and a smooth hosting experience rather than guest records or invitation workflows.",
    executionNotes: "Keep the project light but practical: headcount, setup zones, supplies, decor ideas, and event-day hosting flow.",
    checklist: ["Set a realistic attendance band", "Confirm seating and food service footprint", "Track decor and hosting supplies"],
    featuredTools: ["Setup zones", "Supplies", "Budget categories", "Inspiration notes"],
    venueFocus: ["Dining", "Lounge / activity zone", "Serving area"],
    inspirationPrompts: ["Tablescapes", "Signage", "Food presentation"],
    seed: milestoneCelebrationSeed
  })
];

export const getProjectBlueprintByKey = (key: string | undefined): ProjectBlueprint | undefined => (
  key ? projectBlueprints.find((blueprint) => blueprint.key === key) : undefined
);

export const isSeededProjectBlueprint = (blueprint: ProjectBlueprint | undefined): blueprint is SeededProjectBlueprint => (
  Boolean(blueprint && blueprint.kind === "seeded")
);

export const summarizeProjectBlueprint = (blueprint: ProjectBlueprint) => {
  if (blueprint.kind === "manual") {
    return {
      phaseCount: blueprint.suggestedPhases.length,
      taskCount: 0,
      noteCount: 0,
      supplyCount: 0,
      budgetCategoryCount: 0
    };
  }

  return {
    phaseCount: blueprint.seed.phases.length,
    taskCount: blueprint.seed.tasks.length,
    noteCount: blueprint.seed.notes.length,
    supplyCount: blueprint.seed.supplies.length,
    budgetCategoryCount: blueprint.seed.budgetCategories.length
  };
};

export const noteCategoryLabels: Record<NoteCategory, string> = {
  general: "General",
  research: "Research",
  reference: "Reference",
  decision: "Decision",
  measurement: "Measurement"
};