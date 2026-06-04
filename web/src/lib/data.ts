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
import {useEffect, useState} from "react";
import {db, functions} from "./firebase";
import {toDate} from "./format";
import type {AuditLog, Bet, BetStatus, Draw, DrawStatus, RiskConfig, RiskStatus, Tally} from "./types";

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

function mapDraw(id: string, data: DocumentData): Draw {
  return {
    drawId: id,
    gameType: data.gameType ?? "STL 2D",
    drawTime: toDate(data.drawTime) ?? new Date(),
    cutoffTime: toDate(data.cutoffTime) ?? new Date(),
    status: (data.status ?? "locked") as DrawStatus,
    officialResult: data.officialResult ?? "",
    defaultPayoutMultiplier: Number(data.defaultPayoutMultiplier ?? 400),
    createdBy: data.createdBy ?? "",
  };
}

function mapBet(id: string, data: DocumentData): Bet {
  return {
    betId: data.betId ?? id,
    drawId: data.drawId ?? "",
    agentId: data.agentId ?? "",
    branchId: data.branchId ?? "",
    gameType: data.gameType ?? "STL 2D",
    number: data.number ?? "",
    amount: Number(data.amount ?? 0),
    payoutMultiplier: Number(data.payoutMultiplier ?? 400),
    exposure: Number(data.exposure ?? 0),
    status: (data.status ?? "accepted") as BetStatus,
    customerRef: data.customerRef ?? "",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    approvedBy: data.approvedBy,
    approvedAt: toDate(data.approvedAt),
    voidReason: data.voidReason,
  };
}

function mapTally(id: string, data: DocumentData): Tally {
  return {
    number: data.number ?? id,
    totalAmount: Number(data.totalAmount ?? 0),
    exposure: Number(data.exposure ?? 0),
    betCount: Number(data.betCount ?? 0),
    riskLimit: Number(data.riskLimit ?? 100000),
    riskStatus: (data.riskStatus ?? "green") as RiskStatus,
    blocked: data.blocked === true,
  };
}

function mapRiskConfig(id: string, data: DocumentData): RiskConfig {
  return {
    number: data.number ?? id,
    riskLimit: Number(data.riskLimit ?? 100000),
    warningThresholdPercent: Number(data.warningThresholdPercent ?? 60),
    orangeThresholdPercent: Number(data.orangeThresholdPercent ?? 85),
    blockThresholdPercent: Number(data.blockThresholdPercent ?? 100),
    manuallyBlocked: data.manuallyBlocked === true,
  };
}

function mapAuditLog(id: string, data: DocumentData): AuditLog {
  return {
    actorId: data.actorId ?? "",
    actorRole: data.actorRole ?? "agent",
    action: data.action ?? "",
    entityType: data.entityType ?? "",
    entityId: data.entityId ?? id,
    reason: data.reason,
    createdAt: toDate(data.createdAt),
  };
}

export function useDraws() {
  return useCollection("draws", mapDraw, [orderBy("drawTime", "desc"), limit(50)], "draws");
}

export function useTallies(drawId?: string) {
  return useCollection(drawId ? `drawTallies/${drawId}/numbers` : null, mapTally, [orderBy("number", "asc")], `tallies:${drawId ?? ""}`);
}

export function useRiskConfig(drawId?: string, number?: string) {
  return useDocument(drawId && number ? `riskConfigs/${drawId}/numbers/${number}` : null, mapRiskConfig);
}

export function useRecentBets(drawId?: string, agentId?: string, admin = false) {
  const constraints: QueryConstraint[] = drawId
    ? [where("drawId", "==", drawId), orderBy("createdAt", "desc"), limit(50)]
    : [orderBy("createdAt", "desc"), limit(50)];
  if (!admin && agentId) constraints.unshift(where("agentId", "==", agentId));
  return useCollection("bets", mapBet, constraints, `bets:${drawId ?? ""}:${agentId ?? ""}:${admin}`);
}

export function usePendingBets(drawId?: string) {
  const constraints: QueryConstraint[] = [where("status", "==", "pendingApproval"), orderBy("createdAt", "desc"), limit(50)];
  if (drawId) constraints.unshift(where("drawId", "==", drawId));
  return useCollection("bets", mapBet, constraints, `pending:${drawId ?? ""}`);
}

export function useAuditLogs() {
  return useCollection("auditLogs", mapAuditLog, [orderBy("createdAt", "desc"), limit(100)], "auditLogs");
}

async function call<T>(name: string, data: unknown): Promise<T> {
  const fn = httpsCallable(functions, name);
  const result = await fn(data);
  return result.data as T;
}

export const api = {
  submitBet: (data: {drawId: string; number: string; amount: number; customerRef: string}) =>
    call<{betId: string; status: BetStatus; message: string}>("submitBet", data),
  requestVoid: (betId: string, reason: string) => call<{ok: true}>("requestVoid", {betId, reason}),
  approveBet: (betId: string) => call<{ok: true}>("approveBet", {betId}),
  rejectBet: (betId: string, reason: string) => call<{ok: true}>("rejectBet", {betId, reason}),
  setRiskConfig: (data: {
    drawId: string;
    number: string;
    riskLimit: number;
    warningThresholdPercent: number;
    orangeThresholdPercent: number;
    blockThresholdPercent: number;
    manuallyBlocked: boolean;
  }) => call<{ok: true}>("setRiskConfig", data),
  createDraw: (data: {gameType: string; drawTimeMillis: number; cutoffTimeMillis: number; defaultPayoutMultiplier: number}) =>
    call<{drawId: string}>("createDraw", data),
  updateDrawStatus: (data: {drawId: string; status: DrawStatus; officialResult?: string}) =>
    call<{ok: true}>("updateDrawStatus", data),
};
