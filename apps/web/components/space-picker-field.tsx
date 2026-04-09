"use client";

import type { SpaceResponse } from "@aegis/types";
import type { ChangeEvent, JSX } from "react";
import { useMemo } from "react";
import { flattenSpaceOptions } from "../lib/spaces";

type SpacePickerFieldProps = {
  label: string;
  spaces: SpaceResponse[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  excludedSpaceIds?: string[];
};

export function SpacePickerField({
  label,
  spaces,
  value,
  onChange,
  placeholder = "Select a space",
  disabled = false,
  className,
  fullWidth = false,
  excludedSpaceIds,
}: SpacePickerFieldProps): JSX.Element {
  const excludedIdSet = useMemo(() => new Set(excludedSpaceIds ?? []), [excludedSpaceIds]);
  const options = useMemo(() => flattenSpaceOptions(spaces).filter((option) => !excludedIdSet.has(option.id)), [excludedIdSet, spaces]);

  return (
    <label className={`field${fullWidth ? " field--full" : ""}${className ? ` ${className}` : ""}`}>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.space.name}`}</option>
        ))}
      </select>
    </label>
  );
}