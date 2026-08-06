"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

type RunOptions<T> = {
  /** Shown on success. Omit to stay silent on the happy path. */
  success?: string | ((data: T) => string);
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
};

/**
 * Standard bridge from a server action to a toast: success and failure are
 * reported the same way everywhere, and callers get an `onError` hook to revert
 * optimistic UI (spec: DnD reverts on a failed persist).
 */
/**
 * A dropped connection rather than a rejected request: DNS failure, offline,
 * VPN blip. The browser surfaces these as a bare TypeError ("Failed to fetch"),
 * which says nothing about whether the server acted on the request.
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "TypeError" ||
    /failed to fetch|networkerror|load failed|err_name_not_resolved|err_network|err_internet_disconnected/i.test(
      error.message,
    )
  );
}

export function useAction() {
  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) => {
      startTransition(async () => {
        let result: ActionResult<T>;
        try {
          result = await action();
        } catch (error) {
          // A server action that throws here never delivered its response —
          // but it may well have completed on the server first. Saying
          // "failed" would be a lie that invites a retry and a duplicate.
          const message = isNetworkError(error)
            ? "Lost connection before the server replied. Your change may already have been saved — refresh the page before trying again."
            : error instanceof Error
              ? error.message
              : "Request failed.";

          toast.error(message, { duration: 10_000 });
          options.onError?.(message);
          return;
        }

        if (result.ok) {
          const message =
            typeof options.success === "function"
              ? options.success(result.data)
              : (options.success ?? result.message);
          if (message) toast.success(message);
          options.onSuccess?.(result.data);
        } else {
          toast.error(result.error);
          options.onError?.(result.error);
        }
      });
    },
    [],
  );

  return { run, isPending };
}
