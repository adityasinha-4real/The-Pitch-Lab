import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
    "font-semibold tracking-tight transition-[transform,background-color,color,box-shadow,border-color] duration-200 ease-out-quint",
    "disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:brightness-[1.06] hover:shadow-[0_0_0_4px_var(--accent-soft),inset_0_-2px_0_rgb(0_0_0/0.18)]",
        secondary: "bg-surface text-text border border-line-strong hover:border-accent-fg hover:text-accent-fg",
        ghost: "text-text hover:bg-surface-2",
        danger: "bg-danger text-white hover:brightness-110",
        link: "text-accent-fg underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "min-h-11 px-3.5 text-sm rounded-xl",
        md: "min-h-11 px-5 text-[0.95rem] rounded-xl",
        lg: "min-h-13 px-7 text-base rounded-2xl",
        icon: "size-11 rounded-xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
