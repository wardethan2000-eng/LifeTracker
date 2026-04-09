import type { SpaceResponse, SpaceType } from "@aegis/types";

export const spaceTypeLabels: Record<SpaceType, string> = {
  building: "Building",
  room: "Room",
  area: "Area",
  shelf: "Shelf",
  cabinet: "Cabinet",
  drawer: "Drawer",
  tub: "Tub",
  bin: "Bin",
  other: "Other"
};

export const spaceTypeBadges: Record<SpaceType, string> = {
  building: "BLD",
  room: "RM",
  area: "AR",
  shelf: "SH",
  cabinet: "CAB",
  drawer: "DRW",
  tub: "TUB",
  bin: "BIN",
  other: "SPC"
};

export const getSpaceTypeLabel = (type: SpaceType): string => spaceTypeLabels[type];

export const getSpaceTypeBadge = (type: SpaceType): string => spaceTypeBadges[type];

export const flattenSpaceOptions = (
  spaces: SpaceResponse[],
  depth = 0
): Array<{ id: string; label: string; depth: number; space: SpaceResponse }> => spaces.flatMap((space) => {
  const current = [{
    id: space.id,
    label: `${"  ".repeat(depth)}${space.name}`,
    depth,
    space
  }];

  if (!space.children || space.children.length === 0) {
    return current;
  }

  return [...current, ...flattenSpaceOptions(space.children, depth + 1)];
});

export const formatSpaceBreadcrumb = (space: Pick<SpaceResponse, "breadcrumb">): string => space.breadcrumb
  .map((segment) => segment.name)
  .join(" / ");