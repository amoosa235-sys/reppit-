import type { InputHTMLAttributes, Ref } from "react";

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

// Matches the design system's FormInput component
// (project/components/FormInput). Fixed 36px height, hairline-secondary
// border swapping to hairline-tertiary on focus. React 19: ref is a plain
// prop, no forwardRef needed.
export function FormInput({ className = "", ref, ...props }: FormInputProps) {
  return (
    <input
      ref={ref}
      className={`font-ds-sans h-9 w-full bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm placeholder:text-ds-dim border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary focus:ring-2 focus:ring-ds-hairline-secondary ${className}`}
      {...props}
    />
  );
}
