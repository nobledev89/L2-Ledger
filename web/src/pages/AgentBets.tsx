import {RotateCcw} from "lucide-react";
import {useState} from "react";
import {useDialog} from "../components/Dialog";
import {useToast} from "../components/Toast";
import {api, useBets} from "../lib/data";
import {dateTime, drawSlotLabel, money} from "../lib/format";
import {statusLabel} from "../lib/labels";
import {errorMessage} from "../lib/useAsyncAction";
import type {AppUser} from "../lib/types";

interface AgentBetsProps {
  user: AppUser;
}

export function AgentBets({user}: AgentBetsProps) {
  const bets = useBets({createdBy: user.uid});
  const dialog = useDialog();
  const toast = useToast();
  const [busySlip, setBusySlip] = useState("");

  async function cancelSlip(slipId: string) {
    const reason = await dialog.prompt({
      title: "Cancel bet slip",
      message: "This cancels every bet on the slip. It can only be done before the draw cutoff.",
      label: "Reason for cancellation",
      placeholder: "e.g. customer changed their mind",
      tone: "danger",
      confirmLabel: "Cancel slip",
      cancelLabel: "Keep slip",
      validate: (value) => (value ? null : "A reason is required."),
    });
    if (reason === null) return;
    setBusySlip(slipId);
    try {
      await api.cancelBetSlip(slipId, reason);
      toast.success("Bet slip cancelled.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusySlip("");
    }
  }

  const hasBets = bets.data.length > 0;

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
                <td><span className={`pill ${bet.status}`}>{statusLabel(bet.status)}</span></td>
                <td>
                  {["accepted", "edited"].includes(bet.status) && (
                    <button
                      className="icon-button danger"
                      disabled={busySlip === bet.slipId}
                      onClick={() => cancelSlip(bet.slipId)}
                      aria-label={`Cancel slip for ${bet.bettorName}`}
                      title="Cancel slip before cutoff"
                    >
                      <RotateCcw size={17} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!hasBets && !bets.loading && !bets.error && (
              <tr className="empty-row">
                <td colSpan={9}>No bets yet. Slips you create will appear here.</td>
              </tr>
            )}
          </tbody>
        </table>
        {bets.loading && <div className="notice">Loading bets...</div>}
        {bets.error && <div className="notice danger">{bets.error}</div>}
      </div>
    </section>
  );
}
