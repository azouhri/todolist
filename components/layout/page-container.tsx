import { cn } from "@/lib/utils";

/**
 * Page width for the ordinary pages. The board deliberately does not use this —
 * it fills the viewport instead.
 *
 * Capped at 1600px rather than Tailwind's 7xl (1280px): this is a dense
 * productivity tool, not an article, so on a wide desktop the extra width should
 * go to task titles and table columns instead of empty margins. The cap still
 * stops lines becoming unreadably long on an ultrawide display.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}
