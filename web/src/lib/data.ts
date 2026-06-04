import {httpsCallable} from "firebase/functions";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import {useEffect, useMemo, useState} from "react";
import {db, functions} from "./firebase";
import {toDate} from "./format";
import type {
  AuditLog,
  Bet,
  BetLineInput,
  BetSlip,
  BetStatus,
  BillingWeek,
  CompensationMode,
  DailyReport,
  Draw,
  DrawSlot,
  DrawStatus,
  FeeMode,
  OperatorAccount,
  PendingSlip,
  Tally,
  Usher,
} from "./types";

function useCollection<T>(
  path: string | null,
  map: (id: string, data: DocumentData) => T,
  constraints: QueryConstraint[] = [],
  key = path ?? "",
): {data: T[]; loading: boolean; error: string} {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!path) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const ref = query(collection(db, path), ...constraints);
    return onSnapshot(
      ref,
      (snap) => {
        setData(snap.docs.map((item) => map(item.id, item.data())));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [path, key]);

  return {data, loading, error};
}

function useDocument<T>(
  path: string | null,
  map: (id: string, data: DocumentData) => T,
): {data: T | null; loading: boolean; error: string} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    return onSnapshot(
      doc(db, path),
      (snap) => {
        setData(snap.exists() ? map(snap.id, snap.data()) : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [path]);

  return {data, loading, error};
}

function mapOperator(id: string, data: DocumentData): OperatorAccount {
  return {
    operatorId: data.operatorId ?? id,
    name: data.name ?? "",
    contactName: data.contactName ?? "",
    contactPhone: data.contactPhone ?? "",
    active: data.active === true,
    billingStatus: data.billingStatus ?? "trial",
    trialStartAt: toDate(data.trialStartAt),
    trialEndsAt: toDate(data.trialEndsAt),
    defaultPayoutMultiplier: Number(data.defaultPayoutMultiplier ?? 400),
    feeMode: data.feeMode ?? "netDailyIncome",
    feePercent: Number(data.feePercent ?? 0),
    feePerUsher: Number(data.feePerUsher ?? 0),
    lockReason: data.lockReason ?? "",
  };
}

function mapUsher(id: string, data: DocumentData): Usher {
  return {
    usherId: data.usherId ?? id,
    userId: data.userId ?? "",
    operatorId: data.operatorId ?? "",
    name: data.name ?? "",
    active: data.active === true,
    compensationMode: data.compensationMode ?? "salary",
    salaryAmount: Number(data.salaryAmount ?? 0),
    percentage: Number(data.percentage ?? 0),
  };
}

function mapDraw(id: string, data: DocumentData): Draw {
  return {
    drawId: data.drawId ?? id,
    operatorId: data.operatorId ?? "",
    drawDate: data.drawDate ?? "",
    drawSlot: data.drawSlot ?? "2pm",
    drawTime: toDate(data.drawTime) ?? new Date(),
    cutoffTime: toDate(data.cutoffTime) ?? new Date(),
    status: data.status ?? "locked",
    winningNumber: data.winningNumber ?? "",
    payoutMultiplier: Number(data.payoutMultiplier ?? data.defaultPayoutMultiplier ?? 400),
  };
}

function mapBet(id: string, data: DocumentData): Bet {
  return {
    betId: data.betId ?? id,
    slipId: data.slipId ?? "",
    referenceCode: data.referenceCode ?? "",
    operatorId: data.operatorId ?? "",
    usherId: data.usherId ?? null,
    createdBy: data.createdBy ?? "",
    createdByRole: data.createdByRole ?? "usher",
    bettorName: data.bettorName ?? "",
    drawId: data.drawId ?? "",
    drawDate: data.drawDate ?? "",
    drawSlot: data.drawSlot ?? "2pm",
    number: data.number ?? "",
    amount: Number(data.amount ?? 0),
    payoutMultiplier: Number(data.payoutMultiplier ?? 400),
    potentialPayout: Number(data.potentialPayout ?? 0),
    status: data.status ?? "accepted",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    syncedAt: toDate(data.syncedAt),
    cancelledAt: toDate(data.cancelledAt),
    paidAt: toDate(data.paidAt),
  };
}

function mapSlip(id: string, data: DocumentData): BetSlip {
  return {
    slipId: data.slipId ?? id,
    referenceCode: data.referenceCode ?? "",
    operatorId: data.operatorId ?? "",
    usherId: data.usherId ?? null,
    createdBy: data.createdBy ?? "",
    createdByRole: data.createdByRole ?? "usher",
    bettorName: data.bettorName ?? "",
    drawId: data.drawId ?? "",
    drawDate: data.drawDate ?? "",
    drawSlot: data.drawSlot ?? "2pm",
    totalAmount: Number(data.totalAmount ?? 0),
    status: data.status ?? "accepted",
    source: data.source ?? "usher",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    syncedAt: toDate(data.syncedAt),
    deviceId: data.deviceId,
  };
}

function mapTally(id: string, data: DocumentData): Tally {
  return {
    number: data.number ?? id,
    totalAmount: Number(data.totalAmount ?? 0),
    potentialPayout: Number(data.potentialPayout ?? 0),
    betCount: Number(data.betCount ?? 0),
  };
}

function mapDailyReport(id: string, data: DocumentData): DailyReport {
  return {
    id,
    operatorId: data.operatorId ?? "",
    date: data.date ?? "",
    grossStakes: Number(data.grossStakes ?? 0),
    payouts: Number(data.payouts ?? 0),
    netDailyIncome: Number(data.netDailyIncome ?? 0),
    totalBets: Number(data.totalBets ?? 0),
    totalSlips: Number(data.totalSlips ?? 0),
    totalUshersActive: Number(data.totalUshersActive ?? 0),
  };
}

function mapBillingWeek(id: string, data: DocumentData): BillingWeek {
  return {
    id,
    operatorId: data.operatorId ?? "",
    weekStartDate: data.weekStartDate ?? "",
    fridayCutoffAt: toDate(data.fridayCutoffAt),
    dueDateSunday: toDate(data.dueDateSunday),
    totalNetDailyIncome: Number(data.totalNetDailyIncome ?? 0),
    totalAdminFee: Number(data.totalAdminFee ?? 0),
    status: data.status ?? "open",
    paidAt: toDate(data.paidAt),
  };
}

function mapAuditLog(id: string, data: DocumentData): AuditLog {
  return {
    actorId: data.actorId ?? "",
    actorRole: data.actorRole ?? "usher",
    operatorId: data.operatorId ?? "",
    action: data.action ?? "",
    entityType: data.entityType ?? "",
    entityId: data.entityId ?? id,
    reason: data.reason,
    createdAt: toDate(data.createdAt),
  };
}

export function useOperators(admin: boolean) {
  return useCollection(admin ? "operators" : null, mapOperator, [orderBy("name", "asc")], `operators:${admin}`);
}

export function useOperator(operatorId?: string) {
  return useDocument(operatorId ? `operators/${operatorId}` : null, mapOperator);
}

export function useUshers(operatorId?: string, admin = false) {
  const constraints: QueryConstraint[] = operatorId ? [where("operatorId", "==", operatorId), orderBy("name", "asc")] : [orderBy("name", "asc")];
  return useCollection(operatorId || admin ? "ushers" : null, mapUsher, constraints, `ushers:${operatorId ?? "all"}:${admin}`);
}

export function useDraws(operatorId?: string, admin = false) {
  const constraints: QueryConstraint[] = operatorId ? [where("operatorId", "==", operatorId), orderBy("drawTime", "desc"), limit(90)] : [orderBy("drawTime", "desc"), limit(150)];
  return useCollection(operatorId || admin ? "draws" : null, mapDraw, constraints, `draws:${operatorId ?? "all"}:${admin}`);
}

export function useTallies(drawId?: string) {
  return useCollection(drawId ? `drawTallies/${drawId}/numbers` : null, mapTally, [orderBy("number", "asc")], `tallies:${drawId ?? ""}`);
}

export function useBets(params: {operatorId?: string; drawId?: string; usherId?: string | null; createdBy?: string; admin?: boolean; status?: BetStatus}) {
  const constraints = useMemo(() => {
    const next: QueryConstraint[] = [];
    if (params.operatorId) next.push(where("operatorId", "==", params.operatorId));
    if (params.drawId) next.push(where("drawId", "==", params.drawId));
    if (params.usherId !== undefined) next.push(where("usherId", "==", params.usherId));
    if (params.createdBy) next.push(where("createdBy", "==", params.createdBy));
    if (params.status) next.push(where("status", "==", params.status));
    next.push(orderBy("createdAt", "desc"), limit(100));
    return next;
  }, [params.operatorId, params.drawId, params.usherId, params.createdBy, params.status]);
  const enabled = Boolean(params.operatorId || params.createdBy || params.admin);
  return useCollection(enabled ? "bets" : null, mapBet, constraints, `bets:${JSON.stringify(params)}`);
}

export function useSlips(params: {operatorId?: string; drawId?: string; createdBy?: string; admin?: boolean}) {
  const constraints = useMemo(() => {
    const next: QueryConstraint[] = [];
    if (params.operatorId) next.push(where("operatorId", "==", params.operatorId));
    if (params.drawId) next.push(where("drawId", "==", params.drawId));
    if (params.createdBy) next.push(where("createdBy", "==", params.createdBy));
    next.push(orderBy("createdAt", "desc"), limit(100));
    return next;
  }, [params.operatorId, params.drawId, params.createdBy]);
  const enabled = Boolean(params.operatorId || params.createdBy || params.admin);
  return useCollection(enabled ? "betSlips" : null, mapSlip, constraints, `slips:${JSON.stringify(params)}`);
}

export function useDailyReports(operatorId?: string, admin = false) {
  const constraints: QueryConstraint[] = operatorId ? [where("operatorId", "==", operatorId), orderBy("date", "desc"), limit(45)] : [orderBy("date", "desc"), limit(100)];
  return useCollection(operatorId || admin ? "dailyReports" : null, mapDailyReport, constraints, `dailyReports:${operatorId ?? "all"}:${admin}`);
}

export function useBillingWeeks(operatorId?: string, admin = false) {
  const constraints: QueryConstraint[] = operatorId ? [where("operatorId", "==", operatorId), orderBy("weekStartDate", "desc"), limit(30)] : [orderBy("weekStartDate", "desc"), limit(100)];
  return useCollection(operatorId || admin ? "operatorBillingWeeks" : null, mapBillingWeek, constraints, `billing:${operatorId ?? "all"}:${admin}`);
}

export function useAuditLogs(operatorId?: string, admin = false) {
  const constraints: QueryConstraint[] = operatorId ? [where("operatorId", "==", operatorId), orderBy("createdAt", "desc"), limit(100)] : [orderBy("createdAt", "desc"), limit(100)];
  return useCollection(operatorId || admin ? "auditLogs" : null, mapAuditLog, constraints, `audit:${operatorId ?? "all"}:${admin}`);
}

async function call<T>(name: string, data: unknown): Promise<T> {
  const fn = httpsCallable(functions, name);
  const result = await fn(data);
  return result.data as T;
}

export const api = {
  submitBetSlip: (data: {drawId: string; bettorName: string; lines: BetLineInput[]; clientSlipId?: string; localCreatedAt?: number; deviceId?: string}) =>
    call<{slipId: string; referenceCode: string; status: BetStatus; message: string}>("submitBetSlip", data),
  cancelBetSlip: (slipId: string, reason: string) => call<{ok: true}>("cancelBetSlipBeforeCutoff", {slipId, reason}),
  enterWinningNumber: (drawId: string, winningNumber: string) => call<{ok: true; winners: number; payoutTotal: number}>("enterWinningNumber", {drawId, winningNumber}),
  markBetPaid: (betId: string) => call<{ok: true}>("markBetPaid", {betId}),
  createFixedDraws: (data: {operatorId?: string; drawDate: string; cutoffMinutesBefore: Record<DrawSlot, number>; payoutMultiplier: number}) =>
    call<{drawIds: string[]}>("createFixedDrawsForDate", data),
  updateDrawConfig: (data: {drawId: string; cutoffTimeMillis: number; payoutMultiplier: number; status: DrawStatus}) => call<{ok: true}>("updateDrawConfig", data),
  addUsher: (data: {operatorId: string; userId: string; name: string; compensationMode: CompensationMode; salaryAmount: number; percentage: number}) =>
    call<{usherId: string}>("addUsher", data),
  updateUsher: (data: {usherId: string; active: boolean; compensationMode: CompensationMode; salaryAmount: number; percentage: number}) => call<{ok: true}>("updateUsher", data),
  addOperator: (data: {name: string; contactName: string; contactPhone: string; defaultPayoutMultiplier: number; feeMode: FeeMode; feePercent: number; feePerUsher: number; trialDays: number}) =>
    call<{operatorId: string}>("addOperator", data),
  updateOperatorBilling: (data: {operatorId: string; billingStatus: string; feeMode: FeeMode; feePercent: number; feePerUsher: number; trialEndsAtMillis?: number; lockReason?: string}) =>
    call<{ok: true}>("updateOperatorBilling", data),
  computeDailyReport: (operatorId: string, date: string) => call<{ok: true}>("computeDailyReport", {operatorId, date}),
  computeWeeklyBilling: (operatorId: string, weekStartDate: string) => call<{ok: true}>("computeWeeklyBilling", {operatorId, weekStartDate}),
  markBillingPaid: (billingId: string) => call<{ok: true}>("markBillingPaid", {billingId}),
  lockOverdueOperators: () => call<{locked: number}>("lockOverdueOperators", {}),
  syncPendingSlip: (slip: PendingSlip) =>
    call<{slipId: string; referenceCode: string; status: BetStatus; message: string}>("submitBetSlip", {
      ...slip,
      clientSlipId: slip.clientSlipId,
    }),
};
