import { format, isValid, parseISO } from "date-fns";

/** Value for a native <input type="date">. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

/** Reads a native <input type="date"> back into a Date at local midnight. */
export function fromDateInputValue(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "—";
  return format(date, "d MMM yyyy");
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "—";
  return format(date, "d MMM yyyy, HH:mm");
}
