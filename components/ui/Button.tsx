import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "invert";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Matches the design system's Button component (project/components/Button).
// Never pair two Primary buttons in the same view - it's the single most
// important element in the conversion hierarchy. Invert is only for use on
// canvas-marketing (the deepest-dark band), where primary reads too bright.
//
// Exported so Next.js <Link> elements styled as buttons (site nav, "go to X"
// actions) can reuse the exact same classes - Link renders an <a>, not a
// <button>, so it can't use this component directly without breaking
// client-side navigation semantics.
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
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
      className={`font-ds-sans border-0 cursor-pointer transition-opacity ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
