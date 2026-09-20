import type { HTMLAttributes } from "react";

export type BadgeVariant = "status" | "priority";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Leading status dot color (e.g. "var(--color-ds-success)"). Status variant only -
   * omit it for states with no meaningful semantic color. Priority never gets a dot. */
  dotColor?: string;
}

// Matches the design system's Badge component (project/components/Badge).
// Status pairs a semantic dot with a filled canvas-level-3 chip; Priority is
// a transparent, low-emphasis label - never give it a filled background.
export function Badge({ variant = "status", dotColor, className = "", children, ...props }: BadgeProps) {
  if (variant === "priority") {
    return (
      <span
        className={`font-ds-sans inline-flex items-center bg-transparent text-ds-mute text-ds-caption rounded-ds-xs px-ds-xs py-ds-xxs ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={`font-ds-sans inline-flex items-center gap-1.5 bg-ds-canvas-level-3 text-ds-body text-ds-caption rounded-ds-xs px-ds-sm py-ds-xxs ${className}`}
      {...props}
    >
      {dotColor && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />}
      {children}
    </span>
  );
}
