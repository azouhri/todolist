import { cn } from "@/lib/utils";

/**
 * Page width. This is a dense productivity tool rather than an article, so it
 * uses the full window: on a wide desktop the space belongs to task titles,
 * owner names and date fields, not to margins. Only the padding scales.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("w-full px-4 py-6 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
