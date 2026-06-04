import {RotateCcw} from "lucide-react";
import {useState} from "react";
import {api, useBets} from "../lib/data";
import {dateTime, drawSlotLabel, money} from "../lib/format";
import type {AppUser} from "../lib/types";

interface AgentBetsProps {
  user: AppUser;
}

export function AgentBets({user}: AgentBetsProps) {
  const bets = useBets({createdBy: user.uid});
  const [busySlip, setBusySlip] = useState("");

  async function cancelSlip(slipId: string) {
    const reason = window.prompt("Reason for cancellation") ?? "";
    if (!reason.trim()) return;
    setBusySlip(slipId);
    try {
      await api.cancelBetSlip(slipId, reason.trim());
    } finally {
      setBusySlip("");
    }
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Usher</span>
          <h2>My Bets</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Reference</th>
              <th>Bettor</th>
              <th>Draw</th>
              <th>Number</th>
              <th>Amount</th>
              <th>Potential payout</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bets.data.map((bet) => (
              <tr key={bet.betId}>
                <td>{dateTime(bet.createdAt)}</td>
                <td>{bet.referenceCode}</td>
                <td>{bet.bettorName}</td>
                <td>{bet.drawDate} {drawSlotLabel(bet.drawSlot)}</td>
                <td className="number-cell">{bet.number}</td>
                <td>{money(bet.amount)}</td>
                <td>{money(bet.potentialPayout)}</td>
                <td><span className={`pill ${bet.status}`}>{bet.status}</span></td>
                <td>
                  {["accepted", "edited"].includes(bet.status) && (
                    <button className="icon-button" disabled={busySlip === bet.slipId} onClick={() => cancelSlip(bet.slipId)} title="Cancel slip before cutoff">
                      <RotateCcw size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bets.loading && <div className="notice">Loading bets...</div>}
        {bets.error && <div className="notice danger">{bets.error}</div>}
      </div>
    </section>
  );
}
