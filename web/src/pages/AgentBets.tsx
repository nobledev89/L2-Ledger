import {RotateCcw} from "lucide-react";
import {useState} from "react";
import {api, useRecentBets} from "../lib/data";
import {dateTime, money} from "../lib/format";

interface AgentBetsProps {
  agentId: string;
}

export function AgentBets({agentId}: AgentBetsProps) {
  const bets = useRecentBets(undefined, agentId, false);
  const [busyBet, setBusyBet] = useState("");

  async function requestVoid(betId: string) {
    const reason = window.prompt("Reason for void request") ?? "";
    if (!reason.trim()) return;
    setBusyBet(betId);
    try {
      await api.requestVoid(betId, reason.trim());
    } finally {
      setBusyBet("");
    }
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Agent</span>
          <h2>My Bets</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Number</th>
              <th>Amount</th>
              <th>Exposure</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bets.data.map((bet) => (
              <tr key={bet.betId}>
                <td>{dateTime(bet.createdAt)}</td>
                <td className="number-cell">{bet.number}</td>
                <td>{money(bet.amount)}</td>
                <td>{money(bet.exposure)}</td>
                <td><span className={`pill ${bet.status}`}>{bet.status}</span></td>
                <td>
                  {bet.status === "accepted" && (
                    <button className="icon-button" disabled={busyBet === bet.betId} onClick={() => requestVoid(bet.betId)} title="Request void">
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
