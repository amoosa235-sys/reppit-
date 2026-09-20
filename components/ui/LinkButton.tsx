import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { BUTTON_VARIANT_CLASSES, type ButtonVariant } from "./Button";

export interface LinkButtonProps
  extends LinkProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
  variant?: ButtonVariant;
}

// next/link renders an <a>, not a <button> - client-side navigation and
// accessibility semantics depend on that, so this reuses Button's variant
// classes on a Link rather than routing nav-style "go to X" actions through
// the Button component itself.
export function LinkButton({ variant = "secondary", className = "", ...props }: LinkButtonProps) {
  return (
    <Link
      className={`font-ds-sans inline-flex items-center justify-center text-center transition-opacity ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
