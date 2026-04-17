import { describe, expect, it } from "vitest";

import { getCanvasObjectPresetByKey, getCanvasObjectPresetSvgPath } from "../lib/canvas-object-presets";

describe("canvas object presets", () => {
  it("resolves preset metadata by key", () => {
    expect(getCanvasObjectPresetByKey("vehicles/car")?.label).toBe("Car");
  });

  it("resolves preset svg paths instead of treating keys like urls", () => {
    expect(getCanvasObjectPresetSvgPath("vehicles/car")).toBe("/objects/vehicles/car.svg");
    expect(getCanvasObjectPresetSvgPath("missing/preset")).toBeNull();
  });
});
