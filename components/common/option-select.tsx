"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Option<T extends string = string> = {
  value: T;
  label: string;
};

/**
 * Thin wrapper over the shadcn Select. Base UI needs an `items` map for the
 * trigger to show the selected item's *label* rather than its raw value, and
 * every select in the app needs that, so it lives in one place.
 */
export function OptionSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  size = "default",
  className,
  ariaLabel,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly Option<T>[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select
      items={options as readonly { value: T; label: string }[]}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
      disabled={disabled}
    >
      <SelectTrigger size={size} className={cn("w-full", className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Builds Options from a readonly enum tuple plus its label map. */
export function optionsFrom<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): Option<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}
