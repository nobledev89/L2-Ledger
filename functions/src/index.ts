import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {v4 as uuidv4} from "uuid";

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const region = "asia-northeast1";
const superAdminEmail = "dpnh1989@gmail.com";
const demoPassword = "Password123";

type Role = "superAdmin" | "operator" | "coOperator" | "manager" | "usher";
type DrawSlot = "2pm" | "5pm" | "9pm";
type FeeMode = "usherBased" | "netDailyIncome";
type CompensationMode = "salary" | "salaryPlusPercentage";

interface Profile {
  uid: string;
  email: string;
  role: Role;
  operatorId: string;
  active: boolean;
  primaryOperator: boolean;
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
  const [userRecord, snap] = await Promise.all([
    auth.getUser(uid),
    db.doc(`users/${uid}`).get(),
  ]);
  const email = (userRecord.email ?? snap.get("email") ?? "").toLowerCase();
  if (email === superAdminEmail && (!snap.exists || snap.get("role") !== "superAdmin")) {
    await db.doc(`users/${uid}`).set({
      uid,
      email,
      name: snap.get("name") ?? "Super Admin",
      role: "superAdmin",
      operatorId: "",
      active: true,
      primaryOperator: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: snap.exists ? snap.get("createdAt") ?? admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  const next = await db.doc(`users/${uid}`).get();
  if (!next.exists || next.get("active") !== true) {
    throw new HttpsError("permission-denied", "Active user profile required.");
  }
  const role = String(next.get("role") ?? "usher") as Role;
  if (role === "superAdmin" && email !== superAdminEmail) {
    throw new HttpsError("permission-denied", "Only the configured super admin email can use super admin access.");
  }
  return {
    uid,
    email,
    role,
    operatorId: next.get("operatorId") ?? "",
    active: true,
    primaryOperator: next.get("primaryOperator") === true,
  };
}

function requireSuperAdmin(user: Profile): void {
  if (user.role !== "superAdmin" || user.email !== superAdminEmail) {
    throw new HttpsError("permission-denied", "Super admin role required.");
  }
}

function requireOperatorStaff(user: Profile): void {
  if (!["operator", "coOperator", "manager", "superAdmin"].includes(user.role)) {
    throw new HttpsError("permission-denied", "Operator staff role required.");
  }
}

function requireFinancialRole(user: Profile): void {
  if (!["operator", "coOperator", "superAdmin"].includes(user.role)) {
    throw new HttpsError("permission-denied", "Financial role required.");
  }
}

function assertOperatorScope(actor: Profile, operatorId: string): void {
  if (actor.role !== "superAdmin" && actor.operatorId !== operatorId) {
    throw new HttpsError("permission-denied", "Cannot access another operator.");
  }
}

function assertCreateRole(actor: Profile, role: Role, operatorId: string): void {
  if (role === "superAdmin") throw new HttpsError("permission-denied", "Super admin creation is disabled.");
  if (actor.role === "superAdmin") return;
  assertOperatorScope(actor, operatorId);
  if (role === "operator") throw new HttpsError("permission-denied", "Only super admin can create operators.");
  if (role === "coOperator" && !(actor.role === "operator" && actor.primaryOperator)) {
    throw new HttpsError("permission-denied", "Only the primary operator or super admin can create co-operators.");
  }
  if (role === "manager" && !["operator", "coOperator"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Only operator staff can create managers.");
  }
  if (role === "usher" && !["operator", "coOperator", "manager"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Only operator staff can create ushers.");
  }
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

function optionalString(value: unknown): string {
  return String(value ?? "").trim();
}

function referenceCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `DQ-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function manilaMillis(drawDate: string, time: string): number {
  return new Date(`${drawDate}T${time}+08:00`).getTime();
}

function isoDateManila(offsetDays = 0): string {
  const base = new Date(Date.now() + offsetDays * 86400000);
  const utc = base.getTime() + base.getTimezoneOffset() * 60000;
  const manila = new Date(utc + 8 * 3600000);
  return manila.toISOString().slice(0, 10);
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

async function createAuthUser(email: string, password: string, name: string): Promise<admin.auth.UserRecord> {
  const normalized = email.toLowerCase();
  try {
    const existing = await auth.getUserByEmail(normalized);
    await auth.updateUser(existing.uid, {displayName: name, disabled: false, password});
    return existing;
  } catch (error) {
    const code = (error as {code?: string}).code ?? "";
    if (code !== "auth/user-not-found") throw error;
    return auth.createUser({email: normalized, password, displayName: name, disabled: false});
  }
}

async function createLoginUser(params: {
  actor: Profile;
  email: string;
  password: string;
  name: string;
  role: Role;
  operatorId: string;
  primaryOperator?: boolean;
  compensationMode?: CompensationMode;
  salaryAmount?: number;
  percentage?: number;
  sharePercent?: number;
  contactPhone?: string;
}): Promise<string> {
  if (params.email.toLowerCase() === superAdminEmail && params.role !== "superAdmin") {
    throw new HttpsError("invalid-argument", "The configured super admin email cannot be assigned another role.");
  }
  assertCreateRole(params.actor, params.role, params.operatorId);
  const user = await createAuthUser(params.email, params.password, params.name);
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();
  batch.set(db.doc(`users/${user.uid}`), {
    uid: user.uid,
    email: params.email.toLowerCase(),
    name: params.name,
    role: params.role,
    operatorId: params.operatorId,
    active: true,
    primaryOperator: params.primaryOperator === true,
    createdBy: params.actor.uid,
    createdAt: now,
    updatedAt: now,
  }, {merge: true});
  if (params.role === "manager") {
    batch.set(db.doc(`managers/${user.uid}`), {
      managerId: user.uid,
      userId: user.uid,
      operatorId: params.operatorId,
      name: params.name,
      email: params.email.toLowerCase(),
      active: true,
      createdBy: params.actor.uid,
      createdAt: now,
      updatedAt: now,
    }, {merge: true});
  }
  if (params.role === "coOperator") {
    batch.set(db.doc(`coOperators/${user.uid}`), {
      coOperatorId: user.uid,
      userId: user.uid,
      operatorId: params.operatorId,
      name: params.name,
      email: params.email.toLowerCase(),
      contactPhone: params.contactPhone ?? "",
      sharePercent: Number(params.sharePercent ?? 0),
      active: true,
      createdBy: params.actor.uid,
      createdAt: now,
      updatedAt: now,
    }, {merge: true});
  }
  if (params.role === "usher") {
    batch.set(db.doc(`ushers/${user.uid}`), {
      usherId: user.uid,
      userId: user.uid,
      operatorId: params.operatorId,
      name: params.name,
      email: params.email.toLowerCase(),
      active: true,
      compensationMode: params.compensationMode ?? "salary",
      salaryAmount: Number(params.salaryAmount ?? 0),
      percentage: Number(params.percentage ?? 0),
      createdBy: params.actor.uid,
      createdAt: now,
      updatedAt: now,
    }, {merge: true});
  }
  audit(batch, params.actor, `${params.role}LoginCreated`, params.role, user.uid, {}, {operatorId: params.operatorId, email: params.email}, "", params.operatorId);
  await batch.commit();
  return user.uid;
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
  if (!["usher", "operator", "coOperator", "manager"].includes(actor.role)) {
    throw new HttpsError("permission-denied", "Only operator staff can submit bets.");
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
  const clientSlipId = optionalString(request.data?.clientSlipId);
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
    const blocked = drawSnap.get("blockedNumbers") as string[] | undefined ?? [];
    const blockedSet = new Set(blocked);
    for (const line of lines) {
      if (blockedSet.has(line.number)) {
        throw new HttpsError("failed-precondition", `Number ${line.number} is blocked for this draw.`);
      }
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
      deviceId: optionalString(request.data?.deviceId),
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
        blocked: false,
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
  requireFinancialRole(actor);
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
  requireFinancialRole(actor);
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
  requireOperatorStaff(actor);
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
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
      blockedNumbers: [],
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
  requireOperatorStaff(actor);
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

export const blockNumberForDraw = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorStaff(actor);
  const drawId = stringValue(request.data?.drawId, "Draw");
  const number = normalizeNumber(request.data?.number);
  const reason = optionalString(request.data?.reason);
  const drawRef = db.doc(`draws/${drawId}`);
  const drawSnap = await drawRef.get();
  if (!drawSnap.exists) throw new HttpsError("not-found", "Draw not found.");
  assertOperatorScope(actor, drawSnap.get("operatorId"));
  const blockId = `${drawSnap.get("operatorId")}_${drawId}_${number}`;
  const batch = db.batch();
  batch.set(db.doc(`blockedNumbers/${blockId}`), {
    blockId,
    operatorId: drawSnap.get("operatorId"),
    drawId,
    number,
    reason,
    active: true,
    blockedBy: actor.uid,
    blockedByRole: actor.role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.update(drawRef, {
    blockedNumbers: admin.firestore.FieldValue.arrayUnion(number),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`drawTallies/${drawId}/numbers/${number}`), {
    operatorId: drawSnap.get("operatorId"),
    drawId,
    number,
    blocked: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  audit(batch, actor, "numberBlocked", "drawNumber", blockId, {}, {number, reason}, reason, drawSnap.get("operatorId"));
  await batch.commit();
  return {ok: true};
});

export const unblockNumberForDraw = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorStaff(actor);
  const drawId = stringValue(request.data?.drawId, "Draw");
  const number = normalizeNumber(request.data?.number);
  const drawRef = db.doc(`draws/${drawId}`);
  const drawSnap = await drawRef.get();
  if (!drawSnap.exists) throw new HttpsError("not-found", "Draw not found.");
  assertOperatorScope(actor, drawSnap.get("operatorId"));
  const blockId = `${drawSnap.get("operatorId")}_${drawId}_${number}`;
  const batch = db.batch();
  batch.set(db.doc(`blockedNumbers/${blockId}`), {
    active: false,
    unblockedBy: actor.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  batch.update(drawRef, {
    blockedNumbers: admin.firestore.FieldValue.arrayRemove(number),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`drawTallies/${drawId}/numbers/${number}`), {
    blocked: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  audit(batch, actor, "numberUnblocked", "drawNumber", blockId, {}, {number}, "", drawSnap.get("operatorId"));
  await batch.commit();
  return {ok: true};
});

export const addOperator = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireSuperAdmin(actor);
  const operatorId = uuidv4();
  const trialDays = Math.max(0, Number(request.data?.trialDays ?? 0));
  const nowMillis = Date.now();
  const name = stringValue(request.data?.name, "Operator name");
  await db.doc(`operators/${operatorId}`).set({
    operatorId,
    name,
    organizationName: name,
    contactName: optionalString(request.data?.contactName),
    contactPhone: optionalString(request.data?.contactPhone),
    active: true,
    billingStatus: trialDays > 0 ? "trial" : "active",
    trialStartAt: admin.firestore.Timestamp.fromMillis(nowMillis),
    trialEndsAt: admin.firestore.Timestamp.fromMillis(nowMillis + trialDays * 86400000),
    defaultPayoutMultiplier: positiveAmount(request.data?.defaultPayoutMultiplier ?? 400, 1),
    feeMode: String(request.data?.feeMode ?? "netDailyIncome") as FeeMode,
    feePercent: Number(request.data?.feePercent ?? 0),
    feePerUsher: Number(request.data?.feePerUsher ?? 0),
    lockReason: "",
    primaryOperatorUserId: "",
    createdBy: actor.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return {operatorId};
});

export const addOperatorWithLogin = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireSuperAdmin(actor);
  const operatorId = uuidv4();
  const trialDays = Math.max(0, Number(request.data?.trialDays ?? 7));
  const nowMillis = Date.now();
  const name = stringValue(request.data?.name, "Operator name");
  const email = stringValue(request.data?.email, "Email").toLowerCase();
  const password = stringValue(request.data?.password ?? demoPassword, "Password");
  await db.doc(`operators/${operatorId}`).set({
    operatorId,
    name,
    organizationName: name,
    contactName: optionalString(request.data?.contactName),
    contactPhone: optionalString(request.data?.contactPhone),
    active: true,
    billingStatus: trialDays > 0 ? "trial" : "active",
    trialStartAt: admin.firestore.Timestamp.fromMillis(nowMillis),
    trialEndsAt: admin.firestore.Timestamp.fromMillis(nowMillis + trialDays * 86400000),
    defaultPayoutMultiplier: positiveAmount(request.data?.defaultPayoutMultiplier ?? 400, 1),
    feeMode: String(request.data?.feeMode ?? "netDailyIncome") as FeeMode,
    feePercent: Number(request.data?.feePercent ?? 0),
    feePerUsher: Number(request.data?.feePerUsher ?? 0),
    lockReason: "",
    primaryOperatorUserId: "",
    createdBy: actor.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const uid = await createLoginUser({actor, email, password, name, role: "operator", operatorId, primaryOperator: true});
  await db.doc(`operators/${operatorId}`).set({primaryOperatorUserId: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
  return {operatorId, uid};
});

export const addCoOperatorWithLogin = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  const uid = await createLoginUser({
    actor,
    email: stringValue(request.data?.email, "Email"),
    password: stringValue(request.data?.password ?? demoPassword, "Password"),
    name: stringValue(request.data?.name, "Name"),
    role: "coOperator",
    operatorId,
    sharePercent: Number(request.data?.sharePercent ?? 0),
    contactPhone: optionalString(request.data?.contactPhone),
  });
  return {uid, coOperatorId: uid};
});

export const addManagerWithLogin = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  const uid = await createLoginUser({
    actor,
    email: stringValue(request.data?.email, "Email"),
    password: stringValue(request.data?.password ?? demoPassword, "Password"),
    name: stringValue(request.data?.name, "Name"),
    role: "manager",
    operatorId,
  });
  return {uid, managerId: uid};
});

export const addUsherWithLogin = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  const compensationMode = String(request.data?.compensationMode ?? "salary") as CompensationMode;
  if (!["salary", "salaryPlusPercentage"].includes(compensationMode)) throw new HttpsError("invalid-argument", "Invalid compensation mode.");
  const uid = await createLoginUser({
    actor,
    email: stringValue(request.data?.email, "Email"),
    password: stringValue(request.data?.password ?? demoPassword, "Password"),
    name: stringValue(request.data?.name, "Name"),
    role: "usher",
    operatorId,
    compensationMode,
    salaryAmount: Number(request.data?.salaryAmount ?? 0),
    percentage: Number(request.data?.percentage ?? 0),
  });
  return {uid, usherId: uid};
});

export const addUsher = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  const email = optionalString(request.data?.email) || `${stringValue(request.data?.userId, "User UID")}@local.invalid`;
  const uid = await createLoginUser({
    actor,
    email,
    password: stringValue(request.data?.password ?? demoPassword, "Password"),
    name: stringValue(request.data?.name, "Name"),
    role: "usher",
    operatorId,
    compensationMode: String(request.data?.compensationMode ?? "salary") as CompensationMode,
    salaryAmount: Number(request.data?.salaryAmount ?? 0),
    percentage: Number(request.data?.percentage ?? 0),
  });
  return {usherId: uid};
});

export const updateUsher = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireOperatorStaff(actor);
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

export const updateOperatorBilling = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireSuperAdmin(actor);
  const operatorId = stringValue(request.data?.operatorId, "Operator");
  const billingStatus = String(request.data?.billingStatus ?? "active");
  if (!["trial", "active", "due", "overdue", "locked"].includes(billingStatus)) throw new HttpsError("invalid-argument", "Invalid billing status.");
  await db.doc(`operators/${operatorId}`).set({
    billingStatus,
    feeMode: String(request.data?.feeMode ?? "netDailyIncome"),
    feePercent: Number(request.data?.feePercent ?? 0),
    feePerUsher: Number(request.data?.feePerUsher ?? 0),
    lockReason: optionalString(request.data?.lockReason),
    ...(request.data?.trialEndsAtMillis ? {trialEndsAt: admin.firestore.Timestamp.fromMillis(Number(request.data.trialEndsAtMillis))} : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return {ok: true};
});

export const computeDailyReport = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireFinancialRole(actor);
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
  assertOperatorScope(actor, operatorId);
  const date = stringValue(request.data?.date, "Date");
  await reportForDate(operatorId, date);
  return {ok: true};
});

export const computeWeeklyBilling = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireFinancialRole(actor);
  const operatorId = actor.role === "superAdmin" ? stringValue(request.data?.operatorId, "Operator") : actor.operatorId;
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
  requireSuperAdmin(actor);
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
  requireSuperAdmin(actor);
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

export const seedDemoData = onCall({region, timeoutSeconds: 540, memory: "1GiB"}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireSuperAdmin(actor);
  const password = String(request.data?.password ?? demoPassword);
  const superUser = await createAuthUser(superAdminEmail, password, "Super Admin");
  await db.doc(`users/${superUser.uid}`).set({
    uid: superUser.uid,
    email: superAdminEmail,
    name: "Super Admin",
    role: "superAdmin",
    operatorId: "",
    active: true,
    primaryOperator: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  const created: Record<string, string[]> = {operators: [], users: [], draws: [], bets: []};
  for (let opIndex = 1; opIndex <= 2; opIndex++) {
    const operatorId = `demo_operator_${opIndex}`;
    const operatorName = `Demo Operator ${opIndex}`;
    await db.doc(`operators/${operatorId}`).set({
      operatorId,
      name: operatorName,
      organizationName: operatorName,
      contactName: `Owner ${opIndex}`,
      contactPhone: `+63917000000${opIndex}`,
      active: true,
      billingStatus: "active",
      trialStartAt: admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 86400000),
      trialEndsAt: admin.firestore.Timestamp.fromMillis(Date.now() + 14 * 86400000),
      defaultPayoutMultiplier: 400,
      feeMode: "netDailyIncome",
      feePercent: 5,
      feePerUsher: 250,
      lockReason: "",
      primaryOperatorUserId: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    created.operators.push(operatorId);

    const operatorUid = await createLoginUser({actor, email: `operator${opIndex}@test.local`, password, name: operatorName, role: "operator", operatorId, primaryOperator: true});
    await db.doc(`operators/${operatorId}`).set({primaryOperatorUserId: operatorUid}, {merge: true});
    const coOperatorUid = await createLoginUser({actor, email: `cooperator${opIndex}@test.local`, password, name: `Co Operator ${opIndex}`, role: "coOperator", operatorId, sharePercent: 25});
    const managerUid = await createLoginUser({actor, email: `manager${opIndex}@test.local`, password, name: `Manager ${opIndex}`, role: "manager", operatorId});
    created.users.push(operatorUid, coOperatorUid, managerUid);

    const usherUids: string[] = [];
    for (let usherIndex = 1; usherIndex <= 5; usherIndex++) {
      const uid = await createLoginUser({
        actor,
        email: `usher${opIndex}-${usherIndex}@test.local`,
        password,
        name: `Usher ${opIndex}-${usherIndex}`,
        role: "usher",
        operatorId,
        compensationMode: usherIndex % 2 === 0 ? "salaryPlusPercentage" : "salary",
        salaryAmount: 500,
        percentage: usherIndex % 2 === 0 ? 3 : 0,
      });
      usherUids.push(uid);
      created.users.push(uid);
    }

    const batch = db.batch();
    for (let dayOffset = -5; dayOffset <= 3; dayOffset++) {
      const date = isoDateManila(dayOffset);
      for (const slot of Object.keys(slots) as DrawSlot[]) {
        const drawId = `${operatorId}_${date}_${slot}`;
        const drawMillis = manilaMillis(date, slots[slot]);
        const status = dayOffset < 0 ? "completed" : dayOffset === 0 ? "open" : "open";
        const winningNumber = dayOffset < 0 ? String((opIndex * 17 + dayOffset * 5 + slot.length * 3 + 100) % 100).padStart(2, "0") : "";
        const blockedNumbers = dayOffset >= 0 && slot === "5pm" ? ["13", "77"] : [];
        batch.set(db.doc(`draws/${drawId}`), {
          drawId,
          operatorId,
          drawDate: date,
          drawSlot: slot,
          drawTime: admin.firestore.Timestamp.fromMillis(drawMillis),
          cutoffTime: admin.firestore.Timestamp.fromMillis(drawMillis - 15 * 60000),
          status,
          winningNumber,
          blockedNumbers,
          payoutMultiplier: 400,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        created.draws.push(drawId);
        for (const number of blockedNumbers) {
          const blockId = `${operatorId}_${drawId}_${number}`;
          batch.set(db.doc(`blockedNumbers/${blockId}`), {
            blockId,
            operatorId,
            drawId,
            number,
            reason: "Demo red number",
            active: true,
            blockedBy: operatorUid,
            blockedByRole: "operator",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
          batch.set(db.doc(`drawTallies/${drawId}/numbers/${number}`), {
            operatorId,
            drawId,
            number,
            blocked: true,
            totalAmount: 0,
            potentialPayout: 0,
            betCount: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        }
        if (dayOffset <= 0) {
          for (let slipIndex = 1; slipIndex <= 8; slipIndex++) {
            const creatorPool = [operatorUid, coOperatorUid, managerUid, ...usherUids];
            const creator = creatorPool[(slipIndex + dayOffset + slot.length + 10) % creatorPool.length];
            const creatorRole: Role = creator === operatorUid ? "operator" : creator === coOperatorUid ? "coOperator" : creator === managerUid ? "manager" : "usher";
            const usherId = creatorRole === "usher" ? creator : null;
            const slipId = `${drawId}_slip_${slipIndex}`;
            const refCode = `DQ-DEMO-${opIndex}${Math.abs(dayOffset)}${slot.replace("pm", "")}${slipIndex}`;
            const lineCount = slipIndex % 3 === 0 ? 2 : 1;
            let totalAmount = 0;
            batch.set(db.doc(`betSlips/${slipId}`), {
              slipId,
              referenceCode: refCode,
              operatorId,
              usherId,
              createdBy: creator,
              createdByRole: creatorRole,
              bettorName: `Demo Bettor ${opIndex}-${Math.abs(dayOffset)}-${slot}-${slipIndex}`,
              drawId,
              drawDate: date,
              drawSlot: slot,
              totalAmount: 0,
              status: dayOffset < 0 ? "lost" : "accepted",
              source: creatorRole === "usher" ? "usher" : "direct",
              createdAt: admin.firestore.Timestamp.fromMillis(drawMillis - (60 + slipIndex) * 60000),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});
            for (let lineIndex = 1; lineIndex <= lineCount; lineIndex++) {
              const number = String((opIndex * 11 + slipIndex * 7 + lineIndex * 13 + dayOffset * 3 + 500) % 100).padStart(2, "0");
              const amount = 10 + ((slipIndex + lineIndex + opIndex) % 6) * 10;
              totalAmount += amount;
              const betId = `${slipId}_line_${lineIndex}`;
              const won = dayOffset < 0 && number === winningNumber;
              const status = dayOffset < 0 ? (won ? "won" : "lost") : "accepted";
              batch.set(db.doc(`bets/${betId}`), {
                betId,
                slipId,
                referenceCode: refCode,
                operatorId,
                usherId,
                createdBy: creator,
                createdByRole: creatorRole,
                bettorName: `Demo Bettor ${opIndex}-${Math.abs(dayOffset)}-${slot}-${slipIndex}`,
                drawId,
                drawDate: date,
                drawSlot: slot,
                number,
                amount,
                payoutMultiplier: 400,
                potentialPayout: amount * 400,
                status,
                createdAt: admin.firestore.Timestamp.fromMillis(drawMillis - (60 + slipIndex) * 60000),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, {merge: true});
              batch.set(db.doc(`drawTallies/${drawId}/numbers/${number}`), {
                operatorId,
                drawId,
                number,
                totalAmount: admin.firestore.FieldValue.increment(amount),
                potentialPayout: admin.firestore.FieldValue.increment(amount * 400),
                betCount: admin.firestore.FieldValue.increment(1),
                blocked: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, {merge: true});
              created.bets.push(betId);
            }
            batch.set(db.doc(`betSlips/${slipId}`), {totalAmount}, {merge: true});
          }
        }
      }
    }
    await batch.commit();
    for (let dayOffset = -5; dayOffset <= 0; dayOffset++) {
      await reportForDate(operatorId, isoDateManila(dayOffset));
    }
  }
  return created;
});
