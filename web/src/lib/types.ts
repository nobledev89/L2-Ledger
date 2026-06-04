import type {Timestamp} from "firebase/firestore";

export type Role = "usher" | "operator" | "admin";
export type DrawSlot = "2pm" | "5pm" | "9pm";
export type DrawStatus = "open" | "locked" | "completed";
export type BetStatus = "pendingSync" | "accepted" | "edited" | "cancelled" | "won" | "lost" | "paid" | "rejected";
export type BillingStatus = "trial" | "active" | "due" | "overdue" | "locked";
export type FeeMode = "usherBased" | "netDailyIncome";
export type CompensationMode = "salary" | "salaryPlusPercentage";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
  operatorId: string;
  active: boolean;
}

export interface OperatorAccount {
  operatorId: string;
  name: string;
  contactName: string;
  contactPhone: string;
  active: boolean;
  billingStatus: BillingStatus;
  trialStartAt?: Date;
  trialEndsAt?: Date;
  defaultPayoutMultiplier: number;
  feeMode: FeeMode;
  feePercent: number;
  feePerUsher: number;
  lockReason: string;
}

export interface Usher {
  usherId: string;
  userId: string;
  operatorId: string;
  name: string;
  active: boolean;
  compensationMode: CompensationMode;
  salaryAmount: number;
  percentage: number;
}

export interface Draw {
  drawId: string;
  operatorId: string;
  drawDate: string;
  drawSlot: DrawSlot;
  drawTime: Date;
  cutoffTime: Date;
  status: DrawStatus;
  winningNumber: string;
  payoutMultiplier: number;
}

export interface BetLineInput {
  number: string;
  amount: number;
}

export interface BetSlip {
  slipId: string;
  referenceCode: string;
  operatorId: string;
  usherId: string | null;
  createdBy: string;
  createdByRole: "usher" | "operator";
  bettorName: string;
  drawId: string;
  drawDate: string;
  drawSlot: DrawSlot;
  totalAmount: number;
  status: BetStatus;
  source: "usher" | "direct";
  createdAt?: Date;
  updatedAt?: Date;
  syncedAt?: Date;
  deviceId?: string;
}

export interface Bet {
  betId: string;
  slipId: string;
  referenceCode: string;
  operatorId: string;
  usherId: string | null;
  createdBy: string;
  createdByRole: "usher" | "operator";
  bettorName: string;
  drawId: string;
  drawDate: string;
  drawSlot: DrawSlot;
  number: string;
  amount: number;
  payoutMultiplier: number;
  potentialPayout: number;
  status: BetStatus;
  createdAt?: Date;
  updatedAt?: Date;
  syncedAt?: Date;
  cancelledAt?: Date;
  paidAt?: Date;
}

export interface Tally {
  number: string;
  totalAmount: number;
  potentialPayout: number;
  betCount: number;
}

export interface DailyReport {
  id: string;
  operatorId: string;
  date: string;
  grossStakes: number;
  payouts: number;
  netDailyIncome: number;
  totalBets: number;
  totalSlips: number;
  totalUshersActive: number;
}

export interface BillingWeek {
  id: string;
  operatorId: string;
  weekStartDate: string;
  fridayCutoffAt?: Date;
  dueDateSunday?: Date;
  totalNetDailyIncome: number;
  totalAdminFee: number;
  status: "open" | "due" | "paid" | "overdue" | "locked";
  paidAt?: Date;
}

export interface AuditLog {
  actorId: string;
  actorRole: Role;
  operatorId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  createdAt?: Date;
}

export interface PendingSlip {
  clientSlipId: string;
  operatorId: string;
  usherId: string;
  drawId: string;
  bettorName: string;
  lines: BetLineInput[];
  localCreatedAt: number;
  deviceId: string;
}

export type FirestoreDate = Date | Timestamp | null | undefined;
