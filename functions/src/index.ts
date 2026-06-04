import * as admin from "firebase-admin";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {v4 as uuidv4} from "uuid";

admin.initializeApp();
const db = admin.firestore();
const region = "asia-northeast1";

type Role = "agent" | "admin" | "superAdmin";

interface Profile {
  uid: string;
  role: Role;
  branchId: string;
  active: boolean;
}

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
    role: snap.get("role") ?? "agent",
    branchId: snap.get("branchId") ?? "",
    active: true,
  };
}

function requireAdmin(user: Profile): void {
  if (!["admin", "superAdmin"].includes(user.role)) {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
}

function requireAgent(user: Profile): void {
  if (user.role !== "agent") throw new HttpsError("permission-denied", "Agent role required.");
}

function twoDigit(value: unknown): string {
  const raw = String(value ?? "").trim().padStart(2, "0");
  if (!/^\d{2}$/.test(raw)) throw new HttpsError("invalid-argument", "Number must be 00 to 99.");
  return raw;
}

function positiveAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "Amount must be greater than 0.");
  }
  return amount;
}

function riskStatus(exposure: number, riskLimit: number, blocked = false, warning = 60, orange = 85): string {
  if (blocked) return "blocked";
  if (riskLimit <= 0) return "red";
  const percent = exposure / riskLimit;
  if (percent >= 1) return "red";
  if (percent >= orange / 100) return "orange";
  if (percent >= warning / 100) return "yellow";
  return "green";
}

function audit(tx: admin.firestore.Transaction, actor: Profile, action: string, entityType: string, entityId: string, before: unknown, after: unknown, reason = ""): void {
  tx.set(db.collection("auditLogs").doc(uuidv4()), {
    actorId: actor.uid,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    before: before ?? {},
    after: after ?? {},
    reason,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export const submitBet = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAgent(actor);
  const drawId = String(request.data?.drawId ?? "");
  const number = twoDigit(request.data?.number);
  const amount = positiveAmount(request.data?.amount);
  const customerRef = String(request.data?.customerRef ?? "");
  const betId = uuidv4();

  return db.runTransaction(async (tx) => {
    const drawRef = db.doc(`draws/${drawId}`);
    const drawSnap = await tx.get(drawRef);
    if (!drawSnap.exists) throw new HttpsError("not-found", "Draw not found.");
    const cutoff = drawSnap.get("cutoffTime") as admin.firestore.Timestamp;
    const status = drawSnap.get("status") ?? "locked";
    if (status !== "open" || cutoff.toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "Draw is not open or cutoff has passed.");
    }

    const multiplier = Number(drawSnap.get("defaultPayoutMultiplier") ?? 400);
    const exposure = amount * multiplier;
    const riskRef = db.doc(`riskConfigs/${drawId}/numbers/${number}`);
    const tallyRef = db.doc(`drawTallies/${drawId}/numbers/${number}`);
    const [riskSnap, tallySnap] = await Promise.all([tx.get(riskRef), tx.get(tallyRef)]);
    const manuallyBlocked = riskSnap.get("manuallyBlocked") === true;
    const riskLimit = Number(riskSnap.get("riskLimit") ?? 100000);
    const warning = Number(riskSnap.get("warningThresholdPercent") ?? 60);
    const orange = Number(riskSnap.get("orangeThresholdPercent") ?? 85);
    const currentExposure = Number(tallySnap.get("exposure") ?? 0);
    const currentAmount = Number(tallySnap.get("totalAmount") ?? 0);
    const currentCount = Number(tallySnap.get("betCount") ?? 0);
    const betRef = db.doc(`bets/${betId}`);

    if (manuallyBlocked) {
      tx.set(betRef, {
        betId,
        drawId,
        agentId: actor.uid,
        branchId: actor.branchId,
        gameType: drawSnap.get("gameType") ?? "STL 2D",
        number,
        amount,
        payoutMultiplier: multiplier,
        exposure,
        status: "rejected",
        customerRef,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      audit(tx, actor, "betRejectedBlocked", "bet", betId, {}, {number, amount}, "Number blocked");
      return {betId, status: "rejected", message: "Number is blocked."};
    }

    const projectedExposure = currentExposure + exposure;
    const projectedRisk = riskStatus(projectedExposure, riskLimit, false, warning, orange);
    const betStatus = projectedRisk === "red" ? "pendingApproval" : "accepted";
    tx.set(betRef, {
      betId,
      drawId,
      agentId: actor.uid,
      branchId: actor.branchId,
      gameType: drawSnap.get("gameType") ?? "STL 2D",
      number,
      amount,
      payoutMultiplier: multiplier,
      exposure,
      status: betStatus,
      customerRef,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    if (betStatus === "accepted") {
      tx.set(tallyRef, {
        number,
        totalAmount: currentAmount + amount,
        exposure: projectedExposure,
        betCount: currentCount + 1,
        riskLimit,
        riskStatus: projectedRisk,
        blocked: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
    }
    audit(tx, actor, "betSubmitted", "bet", betId, {}, {number, amount, status: betStatus});
    return {
      betId,
      status: betStatus,
      message: betStatus === "pendingApproval" ? "Bet requires admin approval." : "Bet accepted.",
    };
  });
});

export const requestVoid = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  const betId = String(request.data?.betId ?? "");
  const reason = String(request.data?.reason ?? "");
  return db.runTransaction(async (tx) => {
    const betRef = db.doc(`bets/${betId}`);
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    if (actor.role === "agent" && betSnap.get("agentId") !== actor.uid) {
      throw new HttpsError("permission-denied", "Cannot void another agent's bet.");
    }
    const drawSnap = await tx.get(db.doc(`draws/${betSnap.get("drawId")}`));
    const cutoff = drawSnap.get("cutoffTime") as admin.firestore.Timestamp;
    if (cutoff.toMillis() <= Date.now()) throw new HttpsError("failed-precondition", "Cutoff has passed.");
    const before = betSnap.data();
    tx.update(betRef, {
      status: "voidRequested",
      voidReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    audit(tx, actor, "voidRequested", "bet", betId, before, {status: "voidRequested"}, reason);
    return {ok: true};
  });
});

export const approveBet = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const betId = String(request.data?.betId ?? "");
  return db.runTransaction(async (tx) => {
    const betRef = db.doc(`bets/${betId}`);
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    if (betSnap.get("status") !== "pendingApproval") {
      throw new HttpsError("failed-precondition", "Only pending bets can be approved.");
    }
    const drawId = betSnap.get("drawId");
    const number = betSnap.get("number");
    const amount = Number(betSnap.get("amount") ?? 0);
    const exposureToAdd = Number(betSnap.get("exposure") ?? 0);
    const riskRef = db.doc(`riskConfigs/${drawId}/numbers/${number}`);
    const tallyRef = db.doc(`drawTallies/${drawId}/numbers/${number}`);
    const [riskSnap, tallySnap] = await Promise.all([tx.get(riskRef), tx.get(tallyRef)]);
    const riskLimit = Number(riskSnap.get("riskLimit") ?? 100000);
    const exposure = Number(tallySnap.get("exposure") ?? 0) + exposureToAdd;
    const totalAmount = Number(tallySnap.get("totalAmount") ?? 0) + amount;
    const betCount = Number(tallySnap.get("betCount") ?? 0) + 1;
    tx.update(betRef, {
      status: "accepted",
      approvedBy: actor.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(tallyRef, {
      number,
      totalAmount,
      exposure,
      betCount,
      riskLimit,
      riskStatus: riskStatus(exposure, riskLimit, riskSnap.get("manuallyBlocked") === true),
      blocked: riskSnap.get("manuallyBlocked") === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    audit(tx, actor, "betApproved", "bet", betId, betSnap.data(), {status: "accepted"});
    return {ok: true};
  });
});

export const rejectBet = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const betId = String(request.data?.betId ?? "");
  const reason = String(request.data?.reason ?? "");
  return db.runTransaction(async (tx) => {
    const betRef = db.doc(`bets/${betId}`);
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new HttpsError("not-found", "Bet not found.");
    tx.update(betRef, {
      status: "rejected",
      approvedBy: actor.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    audit(tx, actor, "betRejected", "bet", betId, betSnap.data(), {status: "rejected"}, reason);
    return {ok: true};
  });
});

export const setRiskConfig = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const drawId = String(request.data?.drawId ?? "");
  const number = twoDigit(request.data?.number);
  const riskLimit = positiveAmount(request.data?.riskLimit);
  const manuallyBlocked = request.data?.manuallyBlocked === true;
  const configRef = db.doc(`riskConfigs/${drawId}/numbers/${number}`);
  const tallyRef = db.doc(`drawTallies/${drawId}/numbers/${number}`);
  return db.runTransaction(async (tx) => {
    const [beforeSnap, tallySnap] = await Promise.all([tx.get(configRef), tx.get(tallyRef)]);
    const exposure = Number(tallySnap.get("exposure") ?? 0);
    tx.set(configRef, {
      number,
      riskLimit,
      warningThresholdPercent: Number(request.data?.warningThresholdPercent ?? 60),
      orangeThresholdPercent: Number(request.data?.orangeThresholdPercent ?? 85),
      blockThresholdPercent: Number(request.data?.blockThresholdPercent ?? 100),
      manuallyBlocked,
      updatedBy: actor.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    tx.set(tallyRef, {
      number,
      riskLimit,
      riskStatus: riskStatus(exposure, riskLimit, manuallyBlocked),
      blocked: manuallyBlocked,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    audit(tx, actor, "riskConfigChanged", "riskConfig", `${drawId}/${number}`, beforeSnap.data(), {riskLimit, manuallyBlocked});
    return {ok: true};
  });
});

export const createDraw = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const drawId = uuidv4();
  const drawTime = admin.firestore.Timestamp.fromMillis(Number(request.data?.drawTimeMillis));
  const cutoffTime = admin.firestore.Timestamp.fromMillis(Number(request.data?.cutoffTimeMillis));
  const payout = positiveAmount(request.data?.defaultPayoutMultiplier ?? 400);
  await db.runTransaction(async (tx) => {
    tx.set(db.doc(`draws/${drawId}`), {
      gameType: String(request.data?.gameType ?? "STL 2D"),
      drawTime,
      cutoffTime,
      status: "open",
      officialResult: "",
      defaultPayoutMultiplier: payout,
      createdBy: actor.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    audit(tx, actor, "drawCreated", "draw", drawId, {}, {drawId});
  });
  return {drawId};
});

export const updateDrawStatus = onCall({region}, async (request) => {
  const actor = await profile(requireUid(request.auth?.uid));
  requireAdmin(actor);
  const drawId = String(request.data?.drawId ?? "");
  const status = String(request.data?.status ?? "");
  if (!["open", "locked", "completed"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid draw status.");
  }
  const officialResult = String(request.data?.officialResult ?? "");
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`draws/${drawId}`);
    const before = await tx.get(ref);
    tx.set(ref, {
      status,
      ...(officialResult ? {officialResult} : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    audit(tx, actor, "drawStatusChanged", "draw", drawId, before.data(), {status, officialResult});
  });
  return {ok: true};
});
