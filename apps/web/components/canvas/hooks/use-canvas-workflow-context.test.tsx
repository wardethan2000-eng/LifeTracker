import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCanvasWorkflowContext } from "./use-canvas-workflow-context";

describe("useCanvasWorkflowContext", () => {
  it("builds wall drafting context with exact-length controls", () => {
    const { result } = renderHook(() =>
      useCanvasWorkflowContext({
        activeTool: "wall",
        wallChainActive: true,
        wallSegmentCount: 2,
        wallPreviewLengthLabel: "12 ft",
        wallPreviewAngleLabel: "90°",
        exactLengthValue: "12",
        physicalUnit: "ft",
        canApplyExactLength: true,
        onExactLengthChange: vi.fn(),
        onApplyExactLength: vi.fn(),
        onUndoLastWallSegment: vi.fn(),
        onFinishWallChain: vi.fn(),
        onCancel: vi.fn(),
        arcPhase: 0,
        roomPointCount: 0,
        onUndoRoomPoint: vi.fn(),
        onFinishRoomPolygon: vi.fn(),
        calibrationPixelLength: null,
        onCancelCalibration: vi.fn(),
        pendingObjectPlacement: null,
        objectPickerOpen: false,
        onOpenObjectLibrary: vi.fn(),
        onCloseObjectLibrary: vi.fn(),
        openingPreviewReady: false,
      })
    );

    expect(result.current?.title).toBe("Place the next wall segment");
    expect(result.current?.chips).toEqual(["Length 12 ft", "Angle 90°"]);
    expect(result.current?.input?.submitLabel).toBe("Place");
  });

  it("builds room workflow context with finish once enough corners exist", () => {
    const { result } = renderHook(() =>
      useCanvasWorkflowContext({
        activeTool: "room",
        wallChainActive: false,
        wallSegmentCount: 0,
        wallPreviewLengthLabel: null,
        wallPreviewAngleLabel: null,
        exactLengthValue: "",
        physicalUnit: "ft",
        canApplyExactLength: false,
        onExactLengthChange: vi.fn(),
        onApplyExactLength: vi.fn(),
        onUndoLastWallSegment: vi.fn(),
        onFinishWallChain: vi.fn(),
        onCancel: vi.fn(),
        arcPhase: 0,
        roomPointCount: 3,
        onUndoRoomPoint: vi.fn(),
        onFinishRoomPolygon: vi.fn(),
        calibrationPixelLength: null,
        onCancelCalibration: vi.fn(),
        pendingObjectPlacement: null,
        objectPickerOpen: false,
        onOpenObjectLibrary: vi.fn(),
        onCloseObjectLibrary: vi.fn(),
        openingPreviewReady: false,
      })
    );

    expect(result.current?.title).toBe("Trace the room perimeter");
    expect(result.current?.chips).toEqual(["3 corners placed"]);
    expect(result.current?.actions?.find((action) => action.label === "Finish room")?.disabled).toBe(false);
  });

  it("builds placement and calibration contexts from the active workflow state", () => {
    const { result: objectResult } = renderHook(() =>
      useCanvasWorkflowContext({
        activeTool: "object",
        wallChainActive: false,
        wallSegmentCount: 0,
        wallPreviewLengthLabel: null,
        wallPreviewAngleLabel: null,
        exactLengthValue: "",
        physicalUnit: null,
        canApplyExactLength: false,
        onExactLengthChange: vi.fn(),
        onApplyExactLength: vi.fn(),
        onUndoLastWallSegment: vi.fn(),
        onFinishWallChain: vi.fn(),
        onCancel: vi.fn(),
        arcPhase: 0,
        roomPointCount: 0,
        onUndoRoomPoint: vi.fn(),
        onFinishRoomPolygon: vi.fn(),
        calibrationPixelLength: null,
        onCancelCalibration: vi.fn(),
        pendingObjectPlacement: {
          source: "preset",
          preset: {
            key: "vehicles/car",
            label: "Car",
            category: "vehicle",
            svgPath: "/objects/vehicles/car.svg",
            defaultWidth: 160,
            defaultHeight: 80,
          },
        },
        objectPickerOpen: false,
        onOpenObjectLibrary: vi.fn(),
        onCloseObjectLibrary: vi.fn(),
        openingPreviewReady: false,
      })
    );

    expect(objectResult.current?.title).toBe("Place the selected object");
    expect(objectResult.current?.chips).toEqual(["Car"]);

    const { result: calibrationResult } = renderHook(() =>
      useCanvasWorkflowContext({
        activeTool: "calibrate",
        wallChainActive: false,
        wallSegmentCount: 0,
        wallPreviewLengthLabel: null,
        wallPreviewAngleLabel: null,
        exactLengthValue: "",
        physicalUnit: "ft",
        canApplyExactLength: false,
        onExactLengthChange: vi.fn(),
        onApplyExactLength: vi.fn(),
        onUndoLastWallSegment: vi.fn(),
        onFinishWallChain: vi.fn(),
        onCancel: vi.fn(),
        arcPhase: 0,
        roomPointCount: 0,
        onUndoRoomPoint: vi.fn(),
        onFinishRoomPolygon: vi.fn(),
        calibrationPixelLength: 240,
        onCancelCalibration: vi.fn(),
        pendingObjectPlacement: null,
        objectPickerOpen: false,
        onOpenObjectLibrary: vi.fn(),
        onCloseObjectLibrary: vi.fn(),
        openingPreviewReady: false,
      })
    );

    expect(calibrationResult.current?.title).toBe("Confirm the known distance");
    expect(calibrationResult.current?.chips).toEqual(["240 px sampled"]);
  });
});
