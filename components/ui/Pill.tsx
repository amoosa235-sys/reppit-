import type { HTMLAttributes } from "react";

export type PillProps = HTMLAttributes<HTMLSpanElement>;

// Matches the design system's Pill component (project/components/Pill).
// The only component that uses radius-pill - for tags and metadata labels,
// not status (that's Badge, which stays rectangular).
export function Pill({ className = "", children, ...props }: PillProps) {
  return (
    <span
      className={`font-ds-sans inline-flex items-center bg-ds-canvas-level-3 text-ds-mute text-ds-caption rounded-ds-pill px-ds-md py-ds-xxs ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
