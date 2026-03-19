"use client";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented-control segmented-control--${size}`} role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={`segmented-control__option${value === option.value ? " segmented-control__option--active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
