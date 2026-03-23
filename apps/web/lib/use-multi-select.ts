import { useCallback, useMemo, useState } from "react";

export type UseMultiSelectReturn = {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleItem: (id: string) => void;
  toggleGroup: (ids: string[], checked: boolean) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
};

export function useMultiSelect(): UseMultiSelectReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((ids: string[], checked: boolean): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]): void => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string): boolean => selectedIds.has(id), [selectedIds]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    selectedCount,
    isSelected,
    toggleItem,
    toggleGroup,
    selectAll,
    clearSelection,
  };
}
