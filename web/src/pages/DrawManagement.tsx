import {Plus, Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {api} from "../lib/data";
import {dateTime} from "../lib/format";
import type {Draw, DrawStatus} from "../lib/types";

interface DrawManagementProps {
  draws: Draw[];
}

export function DrawManagement({draws}: DrawManagementProps) {
  const now = new Date();
  const [gameType, setGameType] = useState("STL 2D");
  const [drawTime, setDrawTime] = useState(localInputDate(new Date(now.getTime() + 2 * 60 * 60 * 1000)));
  const [cutoffTime, setCutoffTime] = useState(localInputDate(new Date(now.getTime() + 105 * 60 * 1000)));
  const [payout, setPayout] = useState("400");
  const [message, setMessage] = useState("");

  async function createDraw(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await api.createDraw({
      gameType,
      drawTimeMillis: new Date(drawTime).getTime(),
      cutoffTimeMillis: new Date(cutoffTime).getTime(),
      defaultPayoutMultiplier: Number(payout),
    });
    setMessage("Draw created.");
  }

  async function update(drawId: string, status: DrawStatus) {
    let officialResult = "";
    if (status === "completed") {
      officialResult = window.prompt("Official result") ?? "";
    }
    await api.updateDrawStatus({drawId, status, officialResult});
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Draw Management</h2>
        </div>
      </div>
      <form className="tool-panel" onSubmit={createDraw}>
        <h3><Plus size={18} /> Create draw</h3>
        <div className="form-grid">
          <label>Game type<input value={gameType} onChange={(event) => setGameType(event.target.value)} /></label>
          <label>Draw time<input type="datetime-local" value={drawTime} onChange={(event) => setDrawTime(event.target.value)} /></label>
          <label>Cutoff time<input type="datetime-local" value={cutoffTime} onChange={(event) => setCutoffTime(event.target.value)} /></label>
          <label>Payout multiplier<input type="number" min="1" value={payout} onChange={(event) => setPayout(event.target.value)} /></label>
        </div>
        {message && <div className="notice">{message}</div>}
        <button className="primary"><Save size={18} /> Create draw</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Draw</th>
              <th>Cutoff</th>
              <th>Result</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {draws.map((draw) => (
              <tr key={draw.drawId}>
                <td>{draw.gameType}</td>
                <td>{dateTime(draw.drawTime)}</td>
                <td>{dateTime(draw.cutoffTime)}</td>
                <td>{draw.officialResult || "-"}</td>
                <td>
                  <select value={draw.status} onChange={(event) => update(draw.drawId, event.target.value as DrawStatus)}>
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

function localInputDate(value: Date): string {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
