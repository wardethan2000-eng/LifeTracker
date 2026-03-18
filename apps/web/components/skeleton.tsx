import type { JSX } from "react";

type SkeletonWidth = "xs" | "sm" | "md" | "lg" | "full";
type SkeletonLineSize = "sm" | "md" | "lg";
type SkeletonBlockVariant = "input" | "button" | "pill" | "row" | "panel" | "avatar";

type SkeletonTextLineProps = {
  size?: SkeletonLineSize;
  width?: SkeletonWidth;
  className?: string;
};

type SkeletonBlockProps = {
  variant?: SkeletonBlockVariant;
  width?: SkeletonWidth;
  className?: string;
};

type SkeletonCardProps = {
  titleWidth?: SkeletonWidth;
  lineWidths?: SkeletonWidth[];
  blockVariant?: Extract<SkeletonBlockVariant, "input" | "row" | "panel">;
  className?: string;
};

export function SkeletonTextLine({ size = "md", width = "full", className }: SkeletonTextLineProps): JSX.Element {
  return <div className={buildClasses("skeleton-bar skeleton__line", [`skeleton__line--${size}`, `skeleton__width--${width}`, className])} aria-hidden="true" />;
}

export function SkeletonBlock({ variant = "panel", width = "full", className }: SkeletonBlockProps): JSX.Element {
  return <div className={buildClasses("skeleton-bar skeleton__block", [`skeleton__block--${variant}`, `skeleton__width--${width}`, className])} aria-hidden="true" />;
}

export function SkeletonCard({
  titleWidth = "md",
  lineWidths = ["full", "lg", "md"],
  blockVariant = "row",
  className,
}: SkeletonCardProps): JSX.Element {
  return (
    <section className={buildClasses("panel skeleton__card", [className])} aria-hidden="true">
      <div className="panel__header">
        <SkeletonTextLine size="md" width={titleWidth} />
      </div>
      <div className="panel__body--padded skeleton__stack">
        {lineWidths.map((width, index) => (
          <SkeletonBlock key={`${width}-${index}`} variant={blockVariant} width={width} />
        ))}
      </div>
    </section>
  );
}

function buildClasses(base: string, tokens: Array<string | undefined>): string {
  return [base, ...tokens].filter(Boolean).join(" ");
}