import type { CanvasObjectCategory } from "@aegis/types";

export interface CanvasObjectPreset {
  key: string;
  label: string;
  category: CanvasObjectCategory;
  /** Path relative to /public, e.g. "/objects/vehicles/car.svg" */
  svgPath: string;
  /** Default width in canvas units */
  defaultWidth: number;
  /** Default height in canvas units */
  defaultHeight: number;
}

export const CANVAS_OBJECT_PRESETS: CanvasObjectPreset[] = [
  // Vehicles
  { key: "vehicles/car", label: "Car", category: "vehicle", svgPath: "/objects/vehicles/car.svg", defaultWidth: 160, defaultHeight: 80 },
  { key: "vehicles/truck", label: "Truck", category: "vehicle", svgPath: "/objects/vehicles/truck.svg", defaultWidth: 180, defaultHeight: 80 },
  { key: "vehicles/suv", label: "SUV", category: "vehicle", svgPath: "/objects/vehicles/suv.svg", defaultWidth: 170, defaultHeight: 80 },
  { key: "vehicles/van", label: "Van", category: "vehicle", svgPath: "/objects/vehicles/van.svg", defaultWidth: 185, defaultHeight: 80 },
  { key: "vehicles/motorcycle", label: "Motorcycle", category: "vehicle", svgPath: "/objects/vehicles/motorcycle.svg", defaultWidth: 140, defaultHeight: 80 },

  // Furniture
  { key: "furniture/sofa", label: "Sofa", category: "furniture", svgPath: "/objects/furniture/sofa.svg", defaultWidth: 180, defaultHeight: 100 },
  { key: "furniture/chair", label: "Chair", category: "furniture", svgPath: "/objects/furniture/chair.svg", defaultWidth: 100, defaultHeight: 100 },
  { key: "furniture/table", label: "Table", category: "furniture", svgPath: "/objects/furniture/table.svg", defaultWidth: 160, defaultHeight: 80 },
  { key: "furniture/bed", label: "Bed", category: "furniture", svgPath: "/objects/furniture/bed.svg", defaultWidth: 200, defaultHeight: 120 },
  { key: "furniture/desk", label: "Desk", category: "furniture", svgPath: "/objects/furniture/desk.svg", defaultWidth: 160, defaultHeight: 120 },

  // Cabinets
  { key: "cabinets/filing-cabinet", label: "Filing Cabinet", category: "cabinet", svgPath: "/objects/cabinets/filing-cabinet.svg", defaultWidth: 90, defaultHeight: 130 },
  { key: "cabinets/bookshelf", label: "Bookshelf", category: "cabinet", svgPath: "/objects/cabinets/bookshelf.svg", defaultWidth: 110, defaultHeight: 140 },
  { key: "cabinets/wardrobe", label: "Wardrobe", category: "cabinet", svgPath: "/objects/cabinets/wardrobe.svg", defaultWidth: 110, defaultHeight: 150 },

  // Appliances
  { key: "appliances/refrigerator", label: "Refrigerator", category: "appliance", svgPath: "/objects/appliances/refrigerator.svg", defaultWidth: 90, defaultHeight: 140 },
  { key: "appliances/washer", label: "Washer", category: "appliance", svgPath: "/objects/appliances/washer.svg", defaultWidth: 100, defaultHeight: 120 },
  { key: "appliances/microwave", label: "Microwave", category: "appliance", svgPath: "/objects/appliances/microwave.svg", defaultWidth: 130, defaultHeight: 90 },

  // Structures
  { key: "structures/house", label: "House", category: "structure", svgPath: "/objects/structures/house.svg", defaultWidth: 160, defaultHeight: 140 },
  { key: "structures/garage", label: "Garage", category: "structure", svgPath: "/objects/structures/garage.svg", defaultWidth: 180, defaultHeight: 130 },
  { key: "structures/shed", label: "Shed", category: "structure", svgPath: "/objects/structures/shed.svg", defaultWidth: 130, defaultHeight: 120 },

  // Tools
  { key: "tools/hammer", label: "Hammer", category: "tool", svgPath: "/objects/tools/hammer.svg", defaultWidth: 80, defaultHeight: 100 },
  { key: "tools/wrench", label: "Wrench", category: "tool", svgPath: "/objects/tools/wrench.svg", defaultWidth: 80, defaultHeight: 100 },

  // People
  { key: "people/person-standing", label: "Person", category: "person", svgPath: "/objects/people/person-standing.svg", defaultWidth: 60, defaultHeight: 120 },

  // Electronics
  { key: "electronics/tv", label: "TV", category: "electronics", svgPath: "/objects/electronics/tv.svg", defaultWidth: 160, defaultHeight: 80 },
  { key: "electronics/computer", label: "Computer", category: "electronics", svgPath: "/objects/electronics/computer.svg", defaultWidth: 140, defaultHeight: 100 },
];

/** Group presets by category for easy rendering in the picker UI */
export const CANVAS_OBJECT_PRESETS_BY_CATEGORY: Record<CanvasObjectCategory, CanvasObjectPreset[]> = {
  vehicle: [],
  furniture: [],
  cabinet: [],
  appliance: [],
  structure: [],
  tool: [],
  person: [],
  electronics: [],
  custom: [],
};

for (const preset of CANVAS_OBJECT_PRESETS) {
  CANVAS_OBJECT_PRESETS_BY_CATEGORY[preset.category].push(preset);
}
