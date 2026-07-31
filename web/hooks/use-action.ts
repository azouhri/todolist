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
export function useAction() {
  const [isPending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) => {
      startTransition(async () => {
        let result: ActionResult<T>;
        try {
          result = await action();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Request failed.";
          toast.error(message);
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
