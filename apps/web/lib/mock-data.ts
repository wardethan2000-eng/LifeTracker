export type WorkState = "overdue" | "due" | "upcoming" | "clear";

export type DueItem = {
  name: string;
  state: Exclude<WorkState, "clear">;
  detail: string;
};

export type AssetCardData = {
  id: string;
  name: string;
  category: "vehicle" | "home" | "yard" | "workshop";
  subtitle: string;
  workState: WorkState;
  nextAction: string;
  dueItems: DueItem[];
  metrics: Array<{ label: string; value: string }>;
  logLine: string;
};

export const overviewStats = [
  {
    label: "Assets needing attention",
    value: "6",
    tone: "alert",
    detail: "Across vehicles, home systems, yard tools, and shop equipment"
  },
  {
    label: "Due this week",
    value: "9",
    tone: "warning",
    detail: "Weighted toward recurring filters, inspections, and fluid service"
  },
  {
    label: "Completed this month",
    value: "14",
    tone: "steady",
    detail: "Recent work history stays attached to each asset card"
  }
] as const;

export const assets: AssetCardData[] = [
  {
    id: "asset-f150",
    name: "F-150",
    category: "vehicle",
    subtitle: "2022 Ford F-150 XLT",
    workState: "overdue",
    nextAction: "Oil service missed by 430 miles or 12 days",
    dueItems: [
      { name: "Engine oil and filter", state: "overdue", detail: "Over by 430 miles" },
      { name: "Tire rotation", state: "due", detail: "Due in 120 miles" }
    ],
    metrics: [
      { label: "Odometer", value: "42,430 mi" },
      { label: "Last service", value: "Oct 29" }
    ],
    logLine: "Last completed: cabin air filter on Feb 10"
  },
  {
    id: "asset-house",
    name: "Maple House",
    category: "home",
    subtitle: "Primary residence",
    workState: "due",
    nextAction: "Two recurring home tasks need attention this week",
    dueItems: [
      { name: "Replace HVAC filter", state: "due", detail: "Due in 3 days" },
      { name: "Inspect fire extinguishers", state: "upcoming", detail: "Due next week" }
    ],
    metrics: [
      { label: "Year built", value: "2008" },
      { label: "Filter size", value: "20x25x1" }
    ],
    logLine: "Last completed: water heater flush on Jan 18"
  },
  {
    id: "asset-mower",
    name: "Toro TimeCutter",
    category: "yard",
    subtitle: "Zero-turn mower",
    workState: "due",
    nextAction: "Season prep and blade work should be scheduled before first use",
    dueItems: [
      { name: "Sharpen or replace blades", state: "due", detail: "Due in 1.8 hours" },
      { name: "Oil change", state: "upcoming", detail: "Due in 6.2 hours" }
    ],
    metrics: [
      { label: "Runtime", value: "48.2 hr" },
      { label: "Storage", value: "Garage bay 2" }
    ],
    logLine: "Last completed: battery maintenance on Nov 07"
  },
  {
    id: "asset-printer",
    name: "Prusa MK4",
    category: "workshop",
    subtitle: "3D printer",
    workState: "clear",
    nextAction: "No urgent work. Calibration check is the next likely touchpoint.",
    dueItems: [
      { name: "Check calibration and alignment", state: "upcoming", detail: "Due in 12 days" }
    ],
    metrics: [
      { label: "Runtime", value: "211 hr" },
      { label: "Nozzle", value: "0.4 mm" }
    ],
    logLine: "Last completed: clean debris and dust on Mar 03"
  },
  {
    id: "asset-saw",
    name: "SawStop CTS",
    category: "workshop",
    subtitle: "Compact table saw",
    workState: "overdue",
    nextAction: "Wear-item inspection has slipped and should be logged soon",
    dueItems: [
      { name: "Inspect belts and tension", state: "overdue", detail: "Overdue by 8 days" }
    ],
    metrics: [
      { label: "Runtime", value: "63 hr" },
      { label: "Blade", value: "40T combo" }
    ],
    logLine: "Last completed: clean debris and dust on Feb 01"
  },
  {
    id: "asset-tractor",
    name: "John Deere X350",
    category: "yard",
    subtitle: "Riding mower",
    workState: "upcoming",
    nextAction: "Pre-season maintenance window opens next week",
    dueItems: [
      { name: "Air filter service", state: "upcoming", detail: "Due in 5 hours" }
    ],
    metrics: [
      { label: "Runtime", value: "95 hr" },
      { label: "Fuel", value: "Stabilized" }
    ],
    logLine: "Last completed: add fuel stabilizer on Oct 14"
  }
];

export const categories = [
  {
    key: "vehicle",
    label: "Vehicles",
    description: "Mileage-led service, inspections, and recurring ownership tasks"
  },
  {
    key: "home",
    label: "Home",
    description: "System maintenance, safety checks, and recurring house care"
  },
  {
    key: "yard",
    label: "Yard",
    description: "Runtime-based upkeep, seasonal prep, and storage reminders"
  },
  {
    key: "workshop",
    label: "Equipment",
    description: "Cleaning, calibration, consumables, and wear-item tracking"
  }
] as const;