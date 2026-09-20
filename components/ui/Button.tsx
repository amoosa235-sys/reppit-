import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "invert";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Matches the design system's Button component (project/components/Button).
// Never pair two Primary buttons in the same view - it's the single most
// important element in the conversion hierarchy. Invert is only for use on
// canvas-marketing (the deepest-dark band), where primary reads too bright.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-ds-primary text-ds-on-primary text-ds-button-cta rounded-ds-button px-ds-2xl py-ds-xl hover:opacity-90",
  secondary:
    "bg-ds-surface-button text-ds-body text-ds-button-sm rounded-ds-sm px-ds-xs h-9 hover:opacity-90",
  invert:
    "bg-ds-button-invert-bg text-ds-canvas text-ds-button-cta rounded-ds-button px-ds-2xl py-ds-xl hover:bg-ds-button-invert-bg-hover",
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`font-ds-sans border-0 cursor-pointer transition-opacity ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
