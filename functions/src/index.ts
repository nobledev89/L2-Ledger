import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {v4 as uuidv4} from "uuid";

admin.initializeApp();
const db = admin.firestore();
const region = "asia-northeast1";

type Role = "usher" | "operator" | "admin";
type DrawSlot = "2pm" | "5pm" | "9pm";
type FeeMode = "usherBased" | "netDailyIncome";

interface Profile {
  uid: string;
  role: Role;
  operatorId: string;
  active: boolean;
}

interface BetLineInput {
  number: string;
  amount: number;
}

const slots: Record<DrawSlot, string> = {
  "2pm": "14:00:00",
  "5pm": "17:00:00",
  "9pm": "21:00:00",
};

function requireUid(uid?: string): string {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return uid;
}

async function profile(uid: string): Promise<Profile> {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.get("active") !== true) {
    throw new HttpsError("permission-denied", "Active user profile required.");
  }
  return {
    uid,
    role: snap.get("role") ?? "usher",
    operatorId: snap.get("operatorId") ?? "",
    active: true,
  };
}

function requireAdmin(user: Profile): void {
  if (user.role !== "admin") throw new HttpsError("permission-denied", "Admin role required.");
}

function requireOperatorOrAdmin(user: Profile): void {
  if (!["operator", "admin"].includes(user.role)) throw new HttpsError("permission-denied", "Operator or admin role required.");
}

function normalizeNumber(value: unknown): string {
  const raw = String(value ?? "").trim().padStart(2, "0");
  if (!/^\d{2}$/.test(raw)) throw new HttpsError("invalid-argument", "Number must be 00 to 99.");
  return raw;
}

function positiveAmount(value: unknown, min = 0): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < min) {
    throw new HttpsError("invalid-argument", `Amount must be at least ${min}.`);
  }
  return amount;
}

function stringValue(value: unknown, field: string): string {
  const result = String(value ?? "").trim();
  if (!result) throw new HttpsError("invalid-argument", `${field} is required.`);
  return result;
}

function referenceCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DQ-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function manilaMillis(drawDate: string, time: string): number {
  return new Date(`${drawDate}T${time}+08:00`).getTime();
}

function audit(
  writer: admin.firestore.WriteBatch | admin.firestore.Transaction,
  actor: Profile,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason = "",
  operatorId = actor.operatorId,
): void {
  const target = writer as admin.firestore.WriteBatch;
  target.set(db.collection("auditLogs").doc(uuidv4()), {
    actorId: actor.uid,
    actorRole: actor.role,
    operatorId,
    action,
    entityType,
    entityId,
    before: before ?? {},
    after: after ?? {},
    reason,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function assertOperatorActive(operatorId: string): Promise<admin.firestore.DocumentSnapshot> {
  const operatorSnap = await db.doc(`operators/${operatorId}`).get();
  if (!operatorSnap.exists || operatorSnap.get("active") !== true) {
    throw new HttpsError("failed-precondition", "Operator is not active.");
  }
  if (operatorSnap.get("billingStatus") === "locked") {
    throw new HttpsError("failed-precondition", "Operator billing is locked.");
  }
  return operatorSnap;
}

function assertOperatorScope(actor: Profile, operatorId: string): void {
  if (actor.role !== "admin" && actor.operatorId !== operatorId) {
    throw new HttpsError("permission-denied", "Cannot access another operator.");
  }
}

async function reportForDate(operatorId: string, date: string): Promise<void> {
  const bets = await db.collection("bets")
    .where("operatorId", "==", operatorId)
    .where("drawDate", "==", date)
    .get();
  let grossStakes = 0;
  let payouts = 0;
  const slipIds = new Set<string>();
  for (const doc of bets.docs) {
    const status = doc.get("status");
    if (!["accepted", "edited", "won", "lost", "paid"].includes(status)) continue;
    grossStakes += Number(doc.get("amount") ?? 0);
    slipIds.add(doc.get("slipId"));
    if (["won", "paid"].includes(status)) payouts += Number(doc.get("potentialPayout") ?? 0);
  }
  const ushers = await db.collection("ushers").where("operatorId", "==", operatorId).where("active", "==", true).get();
  await db.doc(`dailyReports/${operatorId}_${date}`).set({
    operatorId,
    date,
    grossStakes,
    payouts,
    netDailyIncome: grossStakes - payouts,
    totalBets: bets.docs.length,
    totalSlips: slipIds.size,
    totalUshersActive: ushers.size,
    computedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

export const submitBetSlip = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  if (!["usher", "operator"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Only ushers and operators can submit bets.");
  }
  const drawId = stringValue(request.data?.drawId, "Draw");
  const bettorName = stringValue(request.data?.bettorName, "Bettor name");
  const rawLines = request.data?.lines;
  if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 100) {
    throw new HttpsError("invalid-argument", "At least one bet line is required.");
  }
  const lines: BetLineInput[] = rawLines.map((line) => ({
    number: normalizeNumber(line?.number),
    amount: positiveAmount(line?.amount, 10),
  }));
  const clientSlipId = String(request.data?.clientSlipId ?? "").trim();
  const slipId = clientSlipId || uuidv4();
  const slipRef = db.doc(`betSlips/${slipId}`);
  const existing = await slipRef.get();
  if (existing.exists) {
    return {
      slipId,
      referenceCode: existing.get("referenceCode"),
      status: existing.get("status"),
      message: "Slip already synced.",
    };
  }

  return db.runTransaction(async (tx) => {
    const drawRef = db.doc(`draws/${drawId}`);
    const drawSnap = await tx.get(drawRef);
    if (!drawSnap.exists) throw new HttpsError("not-found", "Draw not found.");
    const operatorId = drawSnap.get("operatorId");
    assertOperatorScope(actor, operatorId);
    const operatorSnap = await tx.get(db.doc(`operators/${operatorId}`));
    if (!operatorSnap.exists || operatorSnap.get("active") !== true) throw new HttpsError("failed-precondition", "Operator is not active.");
    if (operatorSnap.get("billingStatus") === "locked") throw new HttpsError("failed-precondition", "Operator billing is locked.");
    const cutoff = drawSnap.get("cutoffTime") as admin.firestore.Timestamp;
    if (drawSnap.get("status") !== "open" || cutoff.toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "Draw is not open or cutoff has passed.");
    }

    let usherId: string | null = null;
    let source: "usher" | "direct" = "direct";
    if (actor.role === "usher") {
      usherId = actor.uid;
      source = "usher";
      const usherSnap = await tx.get(db.doc(`ushers/${usherId}`));
      if (!usherSnap.exists || usherSnap.get("operatorId") !== operatorId || usherSnap.get("active") !== true) {
        throw new HttpsError("permission-denied", "Active usher assignment required.");
      }
    }

    const refCode = referenceCode();
    const multiplier = Number(drawSnap.get("payoutMultiplier") ?? operatorSnap.get("defaultPayoutMultiplier") ?? 400);
    const totalAmount = lines.reduce((sum, line) => sum + line.amount, 0);
    const base = {
      slipId,
      referenceCode: refCode,
      operatorId,
      usherId,
      createdBy: actor.uid,
      createdByRole: actor.role,
      bettorName,
      drawId,
      drawDate: drawSnap.get("drawDate"),
      drawSlot: drawSnap.get("drawSlot"),
      status: "accepted",
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      deviceId: String(request.data?.deviceId ?? ""),
      localCreatedAt: Number(request.data?.localCreatedAt ?? 0),
    };
    tx.set(slipRef, {...base, totalAmount});
    for (const line of lines) {
      const betId = uuidv4();
      const potentialPayout = line.amount * multiplier;
      tx.set(db.doc(`bets/${betId}`), {
        betId,
        ...base,
        number: line.number,
        amount: line.amount,
        payoutMultiplier: multiplier,
        potentialPayout,
      });
      tx.set(db.doc(`drawTallies/${drawId}/numbers/${line.number}`), {
        operatorId,
        drawId,
        number: line.number,
        totalAmount: admin.firestore.FieldValue.increment(line.amount),
        potentialPayout: admin.firestore.FieldValue.increment(potentialPayout),
        betCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    }
    audit(tx, actor, "betSlipSubmitted", "betSlip", slipId, {}, {lineCount: lines.length, totalAmount}, "", operatorId);
    return {slipId, referenceCode: refCode, status: "accepted", message: "Bet slip accepted."};
  });
});

export const cancelBetSlipBeforeCutoff = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  const slipId = stringValue(request.data?.slipId, "Slip");
  const reason = stringValue(request.data?.reason, "Reason");
  const slipRef = db.doc(`betSlips/${slipId}`);
  const slipSnap = await slipRef.get();
  if (!slipSnap.exists) throw new HttpsError("not-found", "Slip not found.");
  assertOperatorScope(actor, slipSnap.get("operatorId"));
  if (actor.role === "usher" && slipSnap.get("createdBy") !== actor.uid) {
    throw new HttpsError("permission-denied", "Cannot cancel another usher's slip.");
  }
  const drawSnap = await db.doc(`draws/${slipSnap.get("drawId")}`).get();
  const cutoff = drawSnap.get("cutoffTime") as admin.firestore.Timestamp;
  if (cutoff.toMillis() <= Date.now()) throw new HttpsError("failed-precondition", "Cutoff has passed.");
  const bets = await db.collection("bets").where("slipId", "==", slipId).get();
  const batch = db.batch();
  batch.update(slipRef, {status: "cancelled", cancelledAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()});
  for (const bet of bets.docs) {
    if (!["accepted", "edited"].includes(bet.get("status"))) continue;
    batch.update(bet.ref, {status: "cancelled", cancelledAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()});
    batch.set(db.doc(`drawTallies/${bet.get("drawId")}/numbers/${bet.get("number")}`), {
      totalAmount: admin.firestore.FieldValue.increment(-Number(bet.get("amount") ?? 0)),
      potentialPayout: admin.firestore.FieldValue.increment(-Number(bet.get("potentialPayout") ?? 0)),
      betCount: admin.firestore.FieldValue.increment(-1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  audit(batch, actor, "betSlipCancelled", "betSlip", slipId, slipSnap.data(), {status: "cancelled"}, reason, slipSnap.get("operatorId"));
  await batch.commit();
  return {ok: true};
});

export const enterWinningNumber = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const drawId = stringValue(request.data?.drawId, "Draw");
  const winningNumber = normalizeNumber(request.data?.winningNumber);
  const drawRef = db.doc(`draws/${drawId}`);
  const drawSnap = await drawRef.get();
  if (!drawSnap.exists) throw new HttpsError("not-found", "Draw not found.");
  const operatorId = drawSnap.get("operatorId");
  assertOperatorScope(actor, operatorId);
  const bets = await db.collection("bets").where("drawId", "==", drawId).get();
  const batch = db.batch();
  let winners = 0;
  let payoutTotal = 0;
  for (const bet of bets.docs) {
    if (!["accepted", "edited"].includes(bet.get("status"))) continue;
    const won = bet.get("number") === winningNumber;
    if (won) {
      winners += 1;
      payoutTotal += Number(bet.get("potentialPayout") ?? 0);
    }
    batch.update(bet.ref, {status: won ? "won" : "lost", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
  }
  batch.update(drawRef, {
    status: "completed",
    winningNumber,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  audit(batch, actor, "winningNumberEntered", "draw", drawId, drawSnap.data(), {winningNumber, winners, payoutTotal}, "", operatorId);
  await batch.commit();
  await reportForDate(operatorId, drawSnap.get("drawDate"));
  return {ok: true, winners, payoutTotal};
});

export const markBetPaid = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const betId = stringValue(request.data?.betId, "Bet");
  const betRef = db.doc(`bets/${betId}`);
  const betSnap = await betRef.get();
  if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
  assertOperatorScope(actor, betSnap.get("operatorId"));
  if (betSnap.get("status") !== "won") throw new HttpsError("failed-precondition", "Only won bets can be marked paid.");
  await betRef.update({status: "paid", paidAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()});
  await reportForDate(betSnap.get("operatorId"), betSnap.get("drawDate"));
  return {ok: true};
});

export const createFixedDrawsForDate = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const operatorId = actor.role === "admin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  assertOperatorScope(actor, operatorId);
  await assertOperatorActive(operatorId);
  const drawDate = stringValue(request.data?.drawDate, "Draw date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) throw new HttpsError("invalid-argument", "Draw date must be YYYY-MM-DD.");
  const payoutMultiplier = positiveAmount(request.data?.payoutMultiplier ?? 400, 1);
  const cutoffMinutes = request.data?.cutoffMinutesBefore ?? {};
  const batch = db.batch();
  const drawIds: string[] = [];
  for (const slot of Object.keys(slots) as DrawSlot[]) {
    const drawId = `${operatorId}_${drawDate}_${slot}`;
    const drawMillis = manilaMillis(drawDate, slots[slot]);
    const cutoffMillis = drawMillis - Number(cutoffMinutes[slot] ?? 15) * 60000;
    drawIds.push(drawId);
    batch.set(db.doc(`draws/${drawId}`), {
      drawId,
      operatorId,
      drawDate,
      drawSlot: slot,
      drawTime: admin.firestore.Timestamp.fromMillis(drawMillis),
      cutoffTime: admin.firestore.Timestamp.fromMillis(cutoffMillis),
      status: "open",
      winningNumber: "",
      payoutMultiplier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  audit(batch, actor, "fixedDrawsCreated", "draw", `${operatorId}_${drawDate}`, {}, {drawIds}, "", operatorId);
  await batch.commit();
  return {drawIds};
});

export const updateDrawConfig = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const drawId = stringValue(request.data?.drawId, "Draw");
  const ref = db.doc(`draws/${drawId}`);
  const before = await ref.get();
  if (!before.exists) throw new HttpsError("not-found", "Draw not found.");
  assertOperatorScope(actor, before.get("operatorId"));
  const status = String(request.data?.status ?? before.get("status"));
  if (!["open", "locked", "completed"].includes(status)) throw new HttpsError("invalid-argument", "Invalid draw status.");
  await ref.update({
    cutoffTime: admin.firestore.Timestamp.fromMillis(Number(request.data?.cutoffTimeMillis)),
    payoutMultiplier: positiveAmount(request.data?.payoutMultiplier ?? before.get("payoutMultiplier"), 1),
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {ok: true};
});

export const addOperator = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const operatorId = uuidv4();
  const trialDays = Math.max(0, Number(request.data?.trialDays ?? 0));
  const now = Date.now();
  await db.doc(`operators/${operatorId}`).set({
    operatorId,
    name: stringValue(request.data?.name, "Operator name"),
    contactName: String(request.data?.contactName ?? ""),
    contactPhone: String(request.data?.contactPhone ?? ""),
    active: true,
    billingStatus: trialDays > 0 ? "trial" : "active",
    trialStartAt: admin.firestore.Timestamp.fromMillis(now),
    trialEndsAt: admin.firestore.Timestamp.fromMillis(now + trialDays * 86400000),
    defaultPayoutMultiplier: positiveAmount(request.data?.defaultPayoutMultiplier ?? 400, 1),
    feeMode: String(request.data?.feeMode ?? "netDailyIncome") as FeeMode,
    feePercent: Number(request.data?.feePercent ?? 0),
    feePerUsher: Number(request.data?.feePerUsher ?? 0),
    lockReason: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {operatorId};
});

export const updateOperatorBilling = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const operatorId = stringValue(request.data?.operatorId, "Operator");
  const billingStatus = String(request.data?.billingStatus ?? "active");
  if (!["trial", "active", "due", "overdue", "locked"].includes(billingStatus)) throw new HttpsError("invalid-argument", "Invalid billing status.");
  await db.doc(`operators/${operatorId}`).set({
    billingStatus,
    feeMode: String(request.data?.feeMode ?? "netDailyIncome"),
    feePercent: Number(request.data?.feePercent ?? 0),
    feePerUsher: Number(request.data?.feePerUsher ?? 0),
    lockReason: String(request.data?.lockReason ?? ""),
    ...(request.data?.trialEndsAtMillis ? {trialEndsAt: admin.firestore.Timestamp.fromMillis(Number(request.data.trialEndsAtMillis))} : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return {ok: true};
});

export const addUsher = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const operatorId = actor.role === "admin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  assertOperatorScope(actor, operatorId);
  const userId = stringValue(request.data?.userId, "User UID");
  const name = stringValue(request.data?.name, "Name");
  const compensationMode = String(request.data?.compensationMode ?? "salary");
  if (!["salary", "salaryPlusPercentage"].includes(compensationMode)) throw new HttpsError("invalid-argument", "Invalid compensation mode.");
  const batch = db.batch();
  batch.set(db.doc(`ushers/${userId}`), {
    usherId: userId,
    userId,
    operatorId,
    name,
    active: true,
    compensationMode,
    salaryAmount: Number(request.data?.salaryAmount ?? 0),
    percentage: Number(request.data?.percentage ?? 0),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.set(db.doc(`users/${userId}`), {uid: userId, name, role: "usher", operatorId, active: true, updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  audit(batch, actor, "usherAdded", "usher", userId, {}, {operatorId, name}, "", operatorId);
  await batch.commit();
  return {usherId: userId};
});

export const updateUsher = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const usherId = stringValue(request.data?.usherId, "Usher");
  const ref = db.doc(`ushers/${usherId}`);
  const before = await ref.get();
  if (!before.exists) throw new HttpsError("not-found", "Usher not found.");
  assertOperatorScope(actor, before.get("operatorId"));
  await ref.update({
    active: request.data?.active === true,
    compensationMode: String(request.data?.compensationMode ?? before.get("compensationMode")),
    salaryAmount: Number(request.data?.salaryAmount ?? before.get("salaryAmount") ?? 0),
    percentage: Number(request.data?.percentage ?? before.get("percentage") ?? 0),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${usherId}`).set({active: request.data?.active === true, updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  return {ok: true};
});

export const computeDailyReport = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const operatorId = actor.role === "admin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  assertOperatorScope(actor, operatorId);
  const date = stringValue(request.data?.date, "Date");
  await reportForDate(operatorId, date);
  return {ok: true};
});

export const computeWeeklyBilling = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorOrAdmin(actor);
  const operatorId = actor.role === "admin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  assertOperatorScope(actor, operatorId);
  const weekStartDate = stringValue(request.data?.weekStartDate, "Week start");
  const operatorSnap = await db.doc(`operators/${operatorId}`).get();
  if (!operatorSnap.exists) throw new HttpsError("not-found", "Operator not found.");
  const reports = await db.collection("dailyReports").where("operatorId", "==", operatorId).where("date", ">=", weekStartDate).limit(7).get();
  let totalNetDailyIncome = 0;
  let activeUshers = 0;
  for (const report of reports.docs) {
    totalNetDailyIncome += Number(report.get("netDailyIncome") ?? 0);
    activeUshers = Math.max(activeUshers, Number(report.get("totalUshersActive") ?? 0));
  }
  const feeMode = String(operatorSnap.get("feeMode") ?? "netDailyIncome");
  const totalAdminFee = feeMode === "usherBased" ? activeUshers * Number(operatorSnap.get("feePerUsher") ?? 0) : Math.max(0, totalNetDailyIncome) * Number(operatorSnap.get("feePercent") ?? 0) / 100;
  const friday = new Date(`${weekStartDate}T21:30:00+08:00`);
  friday.setDate(friday.getDate() + 4);
  const sunday = new Date(`${weekStartDate}T23:59:59+08:00`);
  sunday.setDate(sunday.getDate() + 6);
  const billingId = `${operatorId}_${weekStartDate}`;
  await db.doc(`operatorBillingWeeks/${billingId}`).set({
    operatorId,
    weekStartDate,
    fridayCutoffAt: admin.firestore.Timestamp.fromDate(friday),
    dueDateSunday: admin.firestore.Timestamp.fromDate(sunday),
    totalNetDailyIncome,
    totalAdminFee,
    status: "due",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  await db.doc(`operators/${operatorId}`).set({billingStatus: "due", updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  return {ok: true};
});

export const markBillingPaid = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const billingId = stringValue(request.data?.billingId, "Billing");
  const billingRef = db.doc(`operatorBillingWeeks/${billingId}`);
  const billingSnap = await billingRef.get();
  if (!billingSnap.exists) throw new HttpsError("not-found", "Billing record not found.");
  const batch = db.batch();
  batch.update(billingRef, {status: "paid", paidAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()});
  batch.set(db.doc(`operators/${billingSnap.get("operatorId")}`), {billingStatus: "active", lockReason: "", updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  await batch.commit();
  return {ok: true};
});

export const lockOverdueOperators = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const now = admin.firestore.Timestamp.now();
  const due = await db.collection("operatorBillingWeeks").where("status", "in", ["due", "overdue"]).get();
  const batch = db.batch();
  let locked = 0;
  for (const item of due.docs) {
    const dueDate = item.get("dueDateSunday") as admin.firestore.Timestamp;
    if (dueDate && dueDate.toMillis() < now.toMillis()) {
      batch.update(item.ref, {status: "locked", updatedAt: admin.firestore.FieldValue.serverTimestamp()});
      batch.set(db.doc(`operators/${item.get("operatorId")}`), {
        billingStatus: "locked",
        lockReason: "Unpaid weekly billing after Sunday deadline.",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
      locked += 1;
    }
  }
  await batch.commit();
  return {locked};
});
