import type {Timestamp} from "firebase/firestore";

export type Role = "agent" | "admin" | "superAdmin";
export type DrawStatus = "open" | "locked" | "completed";
export type BetStatus = "accepted" | "pendingApproval" | "rejected" | "voidRequested" | "voided";
export type RiskStatus = "green" | "yellow" | "orange" | "red" | "blocked";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: Role;
  branchId: string;
  active: boolean;
}

export interface Draw {
  drawId: string;
  gameType: string;
  drawTime: Date;
  cutoffTime: Date;
  status: DrawStatus;
  officialResult: string;
  defaultPayoutMultiplier: number;
  createdBy: string;
}

export interface Bet {
  betId: string;
  drawId: string;
  agentId: string;
  branchId: string;
  gameType: string;
  number: string;
  amount: number;
  payoutMultiplier: number;
  exposure: number;
  status: BetStatus;
  customerRef: string;
  createdAt?: Date;
  updatedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  voidReason?: string;
}

export interface Tally {
  number: string;
  totalAmount: number;
  exposure: number;
  betCount: number;
  riskLimit: number;
  riskStatus: RiskStatus;
  blocked: boolean;
}

export interface RiskConfig {
  number: string;
  riskLimit: number;
  warningThresholdPercent: number;
  orangeThresholdPercent: number;
  blockThresholdPercent: number;
  manuallyBlocked: boolean;
}

export interface AuditLog {
  actorId: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  createdAt?: Date;
}

export type FirestoreDate = Date | Timestamp | null | undefined;
