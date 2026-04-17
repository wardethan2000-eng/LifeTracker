import { useMemo } from "react";

import type { ActiveTool } from "../canvas-tools/types";
import type { CanvasObjectPlacement } from "../../canvas-object-picker";
import type { CanvasWorkflowContext } from "../canvas-toolbar";

type UseCanvasWorkflowContextInput = {
  activeTool: ActiveTool;
  wallChainActive: boolean;
  wallSegmentCount: number;
  wallPreviewLengthLabel: string | null;
  wallPreviewAngleLabel: string | null;
  exactLengthValue: string;
  physicalUnit: string | null;
  canApplyExactLength: boolean;
  onExactLengthChange: (value: string) => void;
  onApplyExactLength: () => void;
  onUndoLastWallSegment: () => void;
  onFinishWallChain: () => void;
  onCancel: () => void;
  arcPhase: number;
  roomPointCount: number;
  onUndoRoomPoint: () => void;
  onFinishRoomPolygon: () => void;
  calibrationPixelLength: number | null;
  onCancelCalibration: () => void;
  pendingObjectPlacement: CanvasObjectPlacement | null;
  objectPickerOpen: boolean;
  onOpenObjectLibrary: () => void;
  onCloseObjectLibrary: () => void;
  openingPreviewReady: boolean;
};

export function useCanvasWorkflowContext({
  activeTool,
  wallChainActive,
  wallSegmentCount,
  wallPreviewLengthLabel,
  wallPreviewAngleLabel,
  exactLengthValue,
  physicalUnit,
  canApplyExactLength,
  onExactLengthChange,
  onApplyExactLength,
  onUndoLastWallSegment,
  onFinishWallChain,
  onCancel,
  arcPhase,
  roomPointCount,
  onUndoRoomPoint,
  onFinishRoomPolygon,
  calibrationPixelLength,
  onCancelCalibration,
  pendingObjectPlacement,
  objectPickerOpen,
  onOpenObjectLibrary,
  onCloseObjectLibrary,
  openingPreviewReady,
}: UseCanvasWorkflowContextInput): CanvasWorkflowContext | null {
  return useMemo(() => {
    if (activeTool === "wall") {
      if (!wallChainActive) {
        return null;
      }
      return {
        title: "Place the next wall segment",
        description: "Click to continue the run, or type an exact length before placing the next segment.",
        chips: [
          ...(wallPreviewLengthLabel ? [`Length ${wallPreviewLengthLabel}`] : []),
          ...(wallPreviewAngleLabel ? [`Angle ${wallPreviewAngleLabel}`] : []),
        ],
        input: {
          label: "Length",
          value: exactLengthValue,
          placeholder: physicalUnit ? `Length (${physicalUnit})` : "Length",
          onChange: onExactLengthChange,
          onSubmit: onApplyExactLength,
          canSubmit: canApplyExactLength,
          submitLabel: "Place",
        },
        actions: [
          {
            label: "Undo last",
            onClick: onUndoLastWallSegment,
            disabled: wallSegmentCount === 0,
          },
          {
            label: "Finish run",
            onClick: onFinishWallChain,
            disabled: wallSegmentCount === 0,
          },
          {
            label: "Cancel",
            onClick: onCancel,
          },
        ],
      };
    }

    if (activeTool === "wall-arc") {
      return {
        title: arcPhase === 0 ? "Start a curved wall" : arcPhase === 1 ? "Choose the end point" : "Set the curve depth",
        description: arcPhase === 0
          ? "Click the first endpoint to begin the curved wall."
          : arcPhase === 1
            ? "Click the opposite endpoint, then shape the curve on the next click."
            : "Move to preview the arc and click to commit the curved wall.",
        note: "Esc cancels the curved wall workflow.",
        actions: [{ label: "Cancel", onClick: onCancel }],
      };
    }

    if (activeTool === "room") {
      if (roomPointCount === 0) {
        return null;
      }
      return {
        title: "Trace the room perimeter",
        description: roomPointCount >= 3
          ? "Add more corners or finish the polygon now. Clicking near the first point will also close it."
          : "Keep placing corners. Once you have three or more, you can finish the room.",
        chips: [`${roomPointCount} corner${roomPointCount === 1 ? "" : "s"} placed`],
        actions: [
          {
            label: "Undo point",
            onClick: onUndoRoomPoint,
            disabled: roomPointCount === 0,
          },
          {
            label: "Finish room",
            onClick: onFinishRoomPolygon,
            disabled: roomPointCount < 3,
          },
          {
            label: "Cancel",
            onClick: onCancel,
          },
        ],
      };
    }

    if (activeTool === "calibrate") {
      return {
        title: calibrationPixelLength ? "Confirm the known distance" : "Draw a known measurement",
        description: calibrationPixelLength
          ? "Use the docked scale panel to enter the real-world length for the line you drew."
          : "Click and drag over a known dimension in the reference image to establish scale.",
        chips: calibrationPixelLength ? [`${Math.round(calibrationPixelLength)} px sampled`] : undefined,
        note: "Calibration updates the grid scale for walls, rooms, and dimensions.",
        actions: [{ label: "Cancel", onClick: onCancelCalibration }],
      };
    }

    if (activeTool === "object") {
      const placementLabel = pendingObjectPlacement
        ? pendingObjectPlacement.source === "preset"
          ? pendingObjectPlacement.preset.label
          : pendingObjectPlacement.object.name
        : null;
      if (!objectPickerOpen && !pendingObjectPlacement) {
        return null;
      }
      return {
        title: pendingObjectPlacement ? "Place the selected object" : objectPickerOpen ? "Choose an object" : "Open the object library",
        description: pendingObjectPlacement
          ? `Click the canvas to place ${placementLabel}.`
          : objectPickerOpen
            ? "Pick a preset or saved object, then click the canvas to place it."
            : "Open the object library to choose furniture, fixtures, or custom items.",
        chips: placementLabel ? [placementLabel] : undefined,
        actions: [
          {
            label: objectPickerOpen ? "Close library" : placementLabel ? "Choose different object" : "Open library",
            onClick: objectPickerOpen ? onCloseObjectLibrary : onOpenObjectLibrary,
          },
          {
            label: "Cancel",
            onClick: onCancel,
          },
        ],
      };
    }

    if (activeTool === "door" || activeTool === "window") {
      if (!openingPreviewReady) {
        return null;
      }
      return {
        title: activeTool === "door" ? "Place a door opening" : "Place a window opening",
        description: "Click now to place the opening on the highlighted wall.",
        chips: ["Wall target ready"],
        actions: [{ label: "Cancel", onClick: onCancel }],
      };
    }

    return null;
  }, [
    activeTool,
    arcPhase,
    calibrationPixelLength,
    canApplyExactLength,
    exactLengthValue,
    objectPickerOpen,
    onApplyExactLength,
    onCancel,
    onCancelCalibration,
    onCloseObjectLibrary,
    onExactLengthChange,
    onFinishRoomPolygon,
    onFinishWallChain,
    onOpenObjectLibrary,
    onUndoRoomPoint,
    onUndoLastWallSegment,
    openingPreviewReady,
    pendingObjectPlacement,
    physicalUnit,
    roomPointCount,
    wallChainActive,
    wallPreviewAngleLabel,
    wallPreviewLengthLabel,
    wallSegmentCount,
  ]);
}
