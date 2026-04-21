import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  maxWidth?: "default" | "wide" | "narrow";
  className?: string;
}

export const PageShell = ({ children, maxWidth = "default", className }: PageShellProps) => (
  <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 overflow-x-hidden">
    <div
      className={cn(
        "mx-auto py-6 md:py-8 px-4 md:px-6",
        maxWidth === "wide" && "max-w-[1400px]",
        maxWidth === "default" && "max-w-6xl",
        maxWidth === "narrow" && "max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  </div>
);
