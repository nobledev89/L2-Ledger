import {Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {api} from "../lib/data";
import {dateTime, drawSlotLabel, shortDate} from "../lib/format";
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
  const [message, setMessage] = useState("");

  async function createDraws(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const result = await api.createFixedDraws({
      operatorId: user.role === "admin" ? operator?.operatorId : undefined,
      drawDate,
      cutoffMinutesBefore: cutoffs,
      payoutMultiplier: Number(payout),
    });
    setMessage(`Created or updated ${result.drawIds.length} fixed draws.`);
  }

  async function update(draw: Draw, patch: {status?: DrawStatus; cutoffMinutes?: number; payout?: number}) {
    const cutoffMinutes = patch.cutoffMinutes ?? minutesBefore(draw.drawTime, draw.cutoffTime);
    const cutoff = new Date(draw.drawTime.getTime() - cutoffMinutes * 60000);
    await api.updateDrawConfig({
      drawId: draw.drawId,
      cutoffTimeMillis: cutoff.getTime(),
      payoutMultiplier: patch.payout ?? draw.payoutMultiplier,
      status: patch.status ?? draw.status,
    });
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
        {message && <div className="notice">{message}</div>}
        <button className="primary"><Save size={18} /> Save fixed draws</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Slot</th>
              <th>Draw</th>
              <th>Cutoff</th>
              <th>Multiplier</th>
              <th>Winner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {draws.map((draw) => (
              <tr key={draw.drawId}>
                <td>{draw.drawDate}</td>
                <td>{drawSlotLabel(draw.drawSlot)}</td>
                <td>{dateTime(draw.drawTime)}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={minutesBefore(draw.drawTime, draw.cutoffTime)}
                    onChange={(event) => update(draw, {cutoffMinutes: Number(event.target.value)})}
                  />
                </td>
                <td>
                  <input type="number" min="1" value={draw.payoutMultiplier} onChange={(event) => update(draw, {payout: Number(event.target.value)})} />
                </td>
                <td>{draw.winningNumber || "-"}</td>
                <td>
                  <select value={draw.status} onChange={(event) => update(draw, {status: event.target.value as DrawStatus})}>
                    <option value="open">open</option>
                    <option value="locked">locked</option>
                    <option value="completed">completed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function minutesBefore(drawTime: Date, cutoffTime: Date): number {
  return Math.max(0, Math.round((drawTime.getTime() - cutoffTime.getTime()) / 60000));
}
