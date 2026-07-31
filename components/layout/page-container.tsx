import { cn } from "@/lib/utils";

/**
 * Standard reading width for the ordinary pages. The board deliberately does
 * not use this — it fills the viewport instead.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-6", className)}>
      {children}
    </div>
  );
}
