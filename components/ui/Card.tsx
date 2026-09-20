import type { HTMLAttributes } from "react";

export type CardVariant = "feature" | "panel";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

// Matches the design system's Card component (project/components/Card).
// Feature sits in the marketing feature grid (elevation level 2); Panel is
// the app-UI mockup container, needing to read as floating on pure black
// (elevation level 3). The two share a shape but never a surface color.
const VARIANT_CLASSES: Record<CardVariant, string> = {
  feature: "bg-ds-surface-card border border-[rgba(255,255,255,0.08)] rounded-ds-sm p-ds-md px-ds-lg shadow-ds-card",
  panel: "bg-ds-canvas-panel border border-ds-hairline rounded-ds-sm p-ds-md shadow-ds-panel",
};

export function Card({ variant = "feature", className = "", ...props }: CardProps) {
  return (
    <div
      className={`font-ds-sans text-ds-ink text-ds-body-md ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
