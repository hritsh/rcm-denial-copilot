import { cn } from "../lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
    xs: "h-3 w-3 border",
    sm: "h-4 w-4 border-2",
    md: "h-5 w-5 border-2",
    lg: "h-6 w-6 border-2",
};

interface SpinnerProps {
    size?: SpinnerSize;
    className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex animate-spin rounded-full border-muted-foreground/40 border-t-transparent",
                sizeClasses[size],
                className
            )}
        />
    );
}
