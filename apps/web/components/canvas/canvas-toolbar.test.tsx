import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CanvasToolbar } from "./canvas-toolbar";

describe("CanvasToolbar", () => {
  it("renders workflow guidance and inspector utility tabs", () => {
    const showSelection = vi.fn();

    render(
      <CanvasToolbar
        activeTool="wall"
        onToolChange={vi.fn()}
        hasPhysicalUnits
        onOpenSettings={vi.fn()}
        canvasMode="floorplan"
        selectedCount={0}
        selectedEdgeId={null}
        singleSelected={null}
        allFlowchartSelected={false}
        selectedEdge={null}
        onStartEdge={vi.fn()}
        onChangeColor={vi.fn()}
        onChangeShape={vi.fn()}
        onChangeFillColor={vi.fn()}
        onChangeStrokeColor={vi.fn()}
        onChangeStrokeWidth={vi.fn()}
        onChangeFontSize={vi.fn()}
        onChangeEdgeStyle={vi.fn()}
        onDeleteSelected={vi.fn()}
        physicalUnit="ft"
        pixelsPerUnit={24}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToView={vi.fn()}
        objectPickerOpen={false}
        onToggleObjectPicker={vi.fn()}
        showSettings
        onToggleLayerPanel={vi.fn()}
        showLayerPanel={false}
        floors={[0]}
        activeFloor={0}
        onFloorChange={vi.fn()}
        onAddFloor={vi.fn()}
        onExportSVG={vi.fn()}
        onExportPNG={vi.fn()}
        onExportPDF={vi.fn()}
        toolWorkflowContext={{
          title: "Place the next wall segment",
          description: "Click to continue the wall run.",
          chips: ["Length 12 ft"],
          actions: [{ label: "Cancel", onClick: vi.fn() }],
        }}
        inspectorTab="settings"
        onShowInspectorSelection={showSelection}
        inspectorUtilityContent={<div>Canvas settings content</div>}
      />
    );

    expect(screen.getByText("Place the next wall segment")).toBeInTheDocument();
    expect(screen.getByText("Length 12 ft")).toBeInTheDocument();
    expect(screen.getByText("Canvas settings content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Selection" }));
    expect(showSelection).toHaveBeenCalled();
  });

  it("shows an actionable empty inspector state instead of passive context labels", () => {
    render(
      <CanvasToolbar
        activeTool="select"
        onToolChange={vi.fn()}
        hasPhysicalUnits
        onOpenSettings={vi.fn()}
        canvasMode="floorplan"
        selectedCount={0}
        selectedEdgeId={null}
        singleSelected={null}
        allFlowchartSelected={false}
        selectedEdge={null}
        onStartEdge={vi.fn()}
        onChangeColor={vi.fn()}
        onChangeShape={vi.fn()}
        onChangeFillColor={vi.fn()}
        onChangeStrokeColor={vi.fn()}
        onChangeStrokeWidth={vi.fn()}
        onChangeFontSize={vi.fn()}
        onChangeEdgeStyle={vi.fn()}
        onDeleteSelected={vi.fn()}
        physicalUnit="ft"
        pixelsPerUnit={24}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitToView={vi.fn()}
        objectPickerOpen={false}
        onToggleObjectPicker={vi.fn()}
        showSettings={false}
        onToggleLayerPanel={vi.fn()}
        showLayerPanel={false}
        floors={[0]}
        activeFloor={0}
        onFloorChange={vi.fn()}
        onAddFloor={vi.fn()}
        inspectorTab="selection"
        onShowInspectorSelection={vi.fn()}
      />
    );

    expect(screen.getByText("Nothing selected")).toBeInTheDocument();
    expect(screen.getByText("Select a wall, room, object, or note to edit its properties here.")).toBeInTheDocument();
    expect(screen.queryByText("Active tool")).not.toBeInTheDocument();
    expect(screen.queryByText("Mode")).not.toBeInTheDocument();
  });
});
