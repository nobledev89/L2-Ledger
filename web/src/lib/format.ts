import type {FirestoreDate, RiskStatus} from "./types";

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
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function number2(value: string): string {
  return value.trim().padStart(2, "0").slice(-2);
}

export function riskStatusFor(
  exposure: number,
  riskLimit: number,
  blocked = false,
  warning = 60,
  orange = 85,
): RiskStatus {
  if (blocked) return "blocked";
  if (riskLimit <= 0) return "red";
  const percent = exposure / riskLimit;
  if (percent >= 1) return "red";
  if (percent >= orange / 100) return "orange";
  if (percent >= warning / 100) return "yellow";
  return "green";
}
