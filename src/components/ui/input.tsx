import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex min-h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-text",
        "transition-colors duration-150",
        "focus-visible:border-accent-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
