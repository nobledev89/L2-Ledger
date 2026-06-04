import {Plus, Send, Trash2, Wifi, WifiOff, X} from "lucide-react";
import {FormEvent, useEffect, useMemo, useState} from "react";
import {DrawSelect} from "../components/DrawSelect";
import {api} from "../lib/data";
import {dateTime, drawSlotLabel, money, number2} from "../lib/format";
import type {AppUser, BetLineInput, Draw, OperatorAccount, PendingSlip} from "../lib/types";

const queueKey = "stl.pendingSlips.v1";
const deviceKey = "stl.deviceId.v1";

interface AgentEntryProps {
  user: AppUser;
  operator: OperatorAccount | null;
  draws: Draw[];
  selectedDrawId: string;
  setSelectedDrawId: (id: string) => void;
}

interface ReferenceState {
  referenceCode: string;
  bettorName: string;
  draw: Draw;
  lines: BetLineInput[];
  total: number;
  synced: boolean;
}

export function AgentEntry({user, operator, draws, selectedDrawId, setSelectedDrawId}: AgentEntryProps) {
  const selected = draws.find((draw) => draw.drawId === selectedDrawId);
  const [bettorName, setBettorName] = useState("");
  const [lines, setLines] = useState<BetLineInput[]>([{number: "", amount: 10}]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(loadQueue().length);
  const [reference, setReference] = useState<ReferenceState | null>(null);
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.amount || 0), 0), [lines]);
  const locked = operator?.billingStatus === "locked";

  useEffect(() => {
    const sync = () => syncQueue(setPendingCount, setMessage);
    sync();
    window.addEventListener("online", sync);
    const timer = window.setInterval(sync, 45000);
    return () => {
      window.removeEventListener("online", sync);
      window.clearInterval(timer);
    };
  }, []);

  function updateLine(index: number, patch: Partial<BetLineInput>) {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? {...line, ...patch} : line));
  }

  function addLine() {
    setLines((current) => [...current, {number: "", amount: 10}]);
  }

  function removeLine(index: number) {
    setLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const cleanLines = lines.map((line) => ({number: number2(String(line.number)), amount: Number(line.amount)}));
    if (!bettorName.trim()) return setMessage("Bettor name is required.");
    if (cleanLines.some((line) => !/^\d{2}$/.test(line.number) || line.amount < 10)) return setMessage("Each line needs a number from 00-99 and at least 10 pesos.");
    if (selected.cutoffTime.getTime() <= Date.now()) return setMessage("Cutoff has passed for this draw.");
    if (locked) return setMessage("Operator billing is locked. Bets cannot be added.");
    setBusy(true);
    setMessage("");
    const payload = {
      drawId: selected.drawId,
      bettorName: bettorName.trim(),
      lines: cleanLines,
      clientSlipId: crypto.randomUUID(),
      localCreatedAt: Date.now(),
      deviceId: deviceId(),
    };

    try {
      if (!navigator.onLine) {
        if (user.role !== "usher") return setMessage("Direct operator bets require an online connection.");
        const item: PendingSlip = {
          clientSlipId: payload.clientSlipId,
          operatorId: user.operatorId,
          usherId: user.uid,
          drawId: payload.drawId,
          bettorName: payload.bettorName,
          lines: payload.lines,
          localCreatedAt: payload.localCreatedAt,
          deviceId: payload.deviceId,
        };
        saveQueue([...loadQueue(), item]);
        setPendingCount(loadQueue().length);
        setReference({referenceCode: localReference(payload.clientSlipId), bettorName: payload.bettorName, draw: selected, lines: cleanLines, total, synced: false});
        resetForm();
        return;
      }
      const result = await api.submitBetSlip(payload);
      setReference({referenceCode: result.referenceCode, bettorName: payload.bettorName, draw: selected, lines: cleanLines, total, synced: true});
      resetForm();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setBettorName("");
    setLines([{number: "", amount: 10}]);
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{user.role === "operator" ? "Direct operator bet" : "Usher"}</span>
          <h2>Create Bet Slip</h2>
        </div>
        <div className={`sync-badge ${navigator.onLine ? "online" : "offline"}`}>
          {navigator.onLine ? <Wifi size={17} /> : <WifiOff size={17} />}
          {pendingCount > 0 ? `${pendingCount} pending` : navigator.onLine ? "Online" : "Offline"}
        </div>
      </div>
      {locked && <div className="notice danger">Operator billing is locked. Ushers cannot add bets until payment is marked paid.</div>}
      {pendingCount > 0 && <div className="notice">Pending offline slips must sync before cutoff. Any slip arriving after cutoff will be rejected.</div>}
      <form className="tool-panel" onSubmit={submit}>
        {draws.length > 0 ? <DrawSelect draws={draws} selectedId={selectedDrawId} setSelectedId={setSelectedDrawId} /> : <div className="notice">No open draws are available.</div>}
        {selected && (
          <div className="draw-banner compact">
            <strong>{drawSlotLabel(selected.drawSlot)}</strong>
            <span>Draw {dateTime(selected.drawTime)}</span>
            <span>Cutoff {dateTime(selected.cutoffTime)}</span>
            <span className={`pill ${selected.status}`}>{selected.status}</span>
          </div>
        )}
        <label>
          Bettor name
          <input value={bettorName} onChange={(event) => setBettorName(event.target.value)} autoComplete="off" />
        </label>
        <div className="bet-lines">
          {lines.map((line, index) => (
            <div className="bet-line" key={index}>
              <label>
                Number
                <input inputMode="numeric" maxLength={2} pattern="\d{1,2}" value={line.number} onChange={(event) => updateLine(index, {number: event.target.value})} />
              </label>
              <label>
                Amount
                <input inputMode="decimal" min="10" type="number" value={line.amount} onChange={(event) => updateLine(index, {amount: Number(event.target.value)})} />
              </label>
              <button className="icon-button" type="button" onClick={() => removeLine(index)} title="Remove line"><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
        <div className="actions-row">
          <button className="secondary" type="button" onClick={addLine}><Plus size={17} /> Add number</button>
          <strong>Total {money(total)}</strong>
        </div>
        {message && <div className="notice">{message}</div>}
        <button className="primary" disabled={busy || !selected || locked}>
          <Send size={18} />
          {busy ? "Submitting..." : navigator.onLine ? "Submit slip" : "Save offline"}
        </button>
      </form>
      {reference && <ReferenceModal reference={reference} close={() => setReference(null)} />}
    </section>
  );
}

function ReferenceModal({reference, close}: {reference: ReferenceState; close: () => void}) {
  return (
    <div className="modal-backdrop">
      <div className="modal reference-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">{reference.synced ? "Synced reference" : "Pending sync reference"}</span>
            <h2>{reference.referenceCode}</h2>
          </div>
          <button className="icon-button" type="button" onClick={close} title="Close"><X size={18} /></button>
        </div>
        <div className="reference-card">
          <div><span>Bettor</span><strong>{reference.bettorName}</strong></div>
          <div><span>Draw</span><strong>{reference.draw.drawDate} {drawSlotLabel(reference.draw.drawSlot)}</strong></div>
          {reference.lines.map((line, index) => (
            <div className="reference-line" key={`${line.number}-${index}`}>
              <strong>{line.number}</strong>
              <span>{money(line.amount)}</span>
            </div>
          ))}
          <div className="reference-total"><span>Total</span><strong>{money(reference.total)}</strong></div>
          {!reference.synced && <p className="muted">This slip is not valid until it syncs before cutoff.</p>}
        </div>
      </div>
    </div>
  );
}

function loadQueue(): PendingSlip[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey) ?? "[]") as PendingSlip[];
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingSlip[]) {
  localStorage.setItem(queueKey, JSON.stringify(queue));
}

async function syncQueue(setPendingCount: (value: number) => void, setMessage: (value: string) => void) {
  if (!navigator.onLine) return;
  const queue = loadQueue();
  if (queue.length === 0) return;
  const remaining: PendingSlip[] = [];
  for (const item of queue) {
    try {
      await api.syncPendingSlip(item);
    } catch (err) {
      remaining.push(item);
      setMessage(err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed.");
    }
  }
  saveQueue(remaining);
  setPendingCount(remaining.length);
}

function deviceId(): string {
  const existing = localStorage.getItem(deviceKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(deviceKey, next);
  return next;
}

function localReference(id: string): string {
  return `LOCAL-${id.slice(0, 8).toUpperCase()}`;
}
