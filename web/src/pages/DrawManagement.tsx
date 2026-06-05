import {Save} from "lucide-react";
import {FormEvent, useEffect, useState} from "react";
import {useDialog} from "../components/Dialog";
import {EmptyState} from "../components/EmptyState";
import {Spinner} from "../components/Spinner";
import {api} from "../lib/data";
import {dateTime, drawSlotLabel, shortDate} from "../lib/format";
import {statusLabel} from "../lib/labels";
import {useAsyncAction} from "../lib/useAsyncAction";
import type {AppUser, Draw, DrawSlot, DrawStatus, OperatorAccount} from "../lib/types";

interface DrawManagementProps {
  user: AppUser;
  operator: OperatorAccount | null;
  draws: Draw[];
}

export function DrawManagement({user, operator, draws}: DrawManagementProps) {
  const [drawDate, setDrawDate] = useState(shortDate());
  const [payout, setPayout] = useState(String(operator?.defaultPayoutMultiplier ?? 400));
  const [cutoffs, setCutoffs] = useState<Record<DrawSlot, number>>({["2pm"]: 15, ["5pm"]: 15, ["9pm"]: 15});
  const {busy, run} = useAsyncAction();

  async function createDraws(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        api.createFixedDraws({
          operatorId: user.role === "superAdmin" ? operator?.operatorId : undefined,
          drawDate,
          cutoffMinutesBefore: cutoffs,
          payoutMultiplier: Number(payout),
        }),
      {success: "Fixed draws saved."},
    );
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Operator</span>
          <h2>Fixed Draws</h2>
        </div>
      </div>
      <form className="tool-panel" onSubmit={createDraws}>
        <h3>Generate 2 PM, 5 PM and 9 PM draws</h3>
        <div className="form-grid">
          <label>Date<input type="date" value={drawDate} onChange={(event) => setDrawDate(event.target.value)} /></label>
          <label>Payout multiplier<input type="number" min="1" value={payout} onChange={(event) => setPayout(event.target.value)} /></label>
          {(["2pm", "5pm", "9pm"] as DrawSlot[]).map((slot) => (
            <label key={slot}>{drawSlotLabel(slot)} cutoff minutes before
              <input type="number" min="0" max="180" value={cutoffs[slot]} onChange={(event) => setCutoffs((current) => ({...current, [slot]: Number(event.target.value)}))} />
            </label>
          ))}
        </div>
        <button className="primary" disabled={busy}>
          {busy ? <Spinner /> : <Save size={18} aria-hidden />}
          {busy ? "Saving..." : "Save fixed draws"}
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Slot</th>
              <th>Draw</th>
              <th>Cutoff (min before)</th>
              <th>Multiplier</th>
              <th>Winner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draws.map((draw) => (
              <DrawRow key={draw.drawId} draw={draw} />
            ))}
            {draws.length === 0 && (
              <tr className="empty-row">
                <td colSpan={8}>No draws yet. Generate today's fixed draws above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DrawRow({draw}: {draw: Draw}) {
  const dialog = useDialog();
  const {busy, run} = useAsyncAction();
  const baseCutoff = minutesBefore(draw.drawTime, draw.cutoffTime);
  const [cutoffMinutes, setCutoffMinutes] = useState(baseCutoff);
  const [payout, setPayout] = useState(draw.payoutMultiplier);

  // Re-sync drafts when the underlying draw changes (e.g. after a save lands).
  useEffect(() => {
    setCutoffMinutes(minutesBefore(draw.drawTime, draw.cutoffTime));
    setPayout(draw.payoutMultiplier);
  }, [draw.drawTime, draw.cutoffTime, draw.payoutMultiplier]);

  const dirty = cutoffMinutes !== baseCutoff || payout !== draw.payoutMultiplier;

  function persist(patch: {cutoffMinutes?: number; payout?: number; status?: DrawStatus}, success: string) {
    const minutes = patch.cutoffMinutes ?? cutoffMinutes;
    const cutoff = new Date(draw.drawTime.getTime() - minutes * 60000);
    return run(
      () =>
        api.updateDrawConfig({
          drawId: draw.drawId,
          cutoffTimeMillis: cutoff.getTime(),
          payoutMultiplier: patch.payout ?? payout,
          status: patch.status ?? draw.status,
        }),
      {success},
    );
  }

  async function changeStatus(status: DrawStatus) {
    if (status === draw.status) return;
    if (status === "locked" || status === "completed") {
      const confirmed = await dialog.confirm({
        title: status === "locked" ? "Lock this draw?" : "Mark draw completed?",
        message:
          status === "locked"
            ? "Locking stops new bets for this draw."
            : "Completing closes the draw. Settle the winning number from the Live page if you have not already.",
        confirmLabel: status === "locked" ? "Lock draw" : "Mark completed",
        tone: "danger",
      });
      if (!confirmed) return;
    }
    await persist({status}, `Draw ${statusLabel(status).toLowerCase()}.`);
  }

  return (
    <tr>
      <td>{draw.drawDate}</td>
      <td>{drawSlotLabel(draw.drawSlot)}</td>
      <td>{dateTime(draw.drawTime)}</td>
      <td>
        <input
          type="number"
          min="0"
          max="180"
          value={cutoffMinutes}
          onChange={(event) => setCutoffMinutes(Number(event.target.value))}
          aria-label={`Cutoff minutes for ${draw.drawDate} ${drawSlotLabel(draw.drawSlot)}`}
        />
      </td>
      <td>
        <input
          type="number"
          min="1"
          value={payout}
          onChange={(event) => setPayout(Number(event.target.value))}
          aria-label={`Payout multiplier for ${draw.drawDate} ${drawSlotLabel(draw.drawSlot)}`}
        />
      </td>
      <td>{draw.winningNumber || "-"}</td>
      <td>
        <select
          value={draw.status}
          onChange={(event) => changeStatus(event.target.value as DrawStatus)}
          aria-label={`Status for ${draw.drawDate} ${drawSlotLabel(draw.drawSlot)}`}
        >
          <option value="open">Open</option>
          <option value="locked">Locked</option>
          <option value="completed">Completed</option>
        </select>
      </td>
      <td>
        <button
          className="icon-button success"
          disabled={!dirty || busy}
          onClick={() => persist({}, "Draw updated.")}
          aria-label="Save draw changes"
          title={dirty ? "Save changes" : "No changes"}
        >
          {busy ? <Spinner size={16} /> : <Save size={16} />}
        </button>
      </td>
    </tr>
  );
}

function minutesBefore(drawTime: Date, cutoffTime: Date): number {
  return Math.max(0, Math.round((drawTime.getTime() - cutoffTime.getTime()) / 60000));
}
