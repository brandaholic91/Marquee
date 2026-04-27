import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:opacity-50",
          {
            default:
              "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 px-4 py-2",
            outline:
              "border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))] px-4 py-2",
            ghost: "hover:bg-[hsl(var(--muted))] px-4 py-2",
          }[variant],
          {
            default: "text-sm",
            sm: "text-xs px-3 py-1",
            lg: "text-base px-6 py-3",
          }[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
