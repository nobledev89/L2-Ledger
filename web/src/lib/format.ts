import type {FirestoreDate} from "./types";

export function toDate(value: FirestoreDate): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if ("toDate" in value) return value.toDate();
  return undefined;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function dateTime(value?: Date): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

export function shortDate(value = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Manila"}).format(value);
}

export function drawSlotLabel(slot: string): string {
  if (slot === "2pm") return "2:00 PM";
  if (slot === "5pm") return "5:00 PM";
  if (slot === "9pm") return "9:00 PM";
  return slot;
}

export function number2(value: string): string {
  return value.trim().padStart(2, "0").slice(-2);
}
