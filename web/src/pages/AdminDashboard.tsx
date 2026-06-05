import {Banknote, CheckCircle} from "lucide-react";
import {useMemo, useState} from "react";
import {DrawSelect} from "../components/DrawSelect";
import {api, useBets, useTallies, useUshers} from "../lib/data";
import {dateTime, drawSlotLabel, money} from "../lib/format";
import type {AppUser, Draw, OperatorAccount} from "../lib/types";

interface AdminDashboardProps {
  user: AppUser;
  operator: OperatorAccount | null;
  draws: Draw[];
  selectedDrawId: string;
  setSelectedDrawId: (id: string) => void;
}

export function AdminDashboard({user, operator, draws, selectedDrawId, setSelectedDrawId}: AdminDashboardProps) {
  const selected = draws.find((draw) => draw.drawId === selectedDrawId);
  const [usherFilter, setUsherFilter] = useState("all");
  const tallies = useTallies(selected?.drawId);
  const canSettle = ["operator", "coOperator"].includes(user.role);
  const canBlock = ["operator", "coOperator", "manager"].includes(user.role);
  const readOnlyScope = user.role === "superAdmin";
  const bets = useBets({
    operatorId: operator?.operatorId,
    drawId: selected?.drawId,
    usherId: usherFilter === "all" ? undefined : usherFilter === "direct" ? null : usherFilter,
    admin: user.role === "superAdmin",
  });
  const ushers = useUshers(operator?.operatorId);

  const stats = useMemo(() => {
    const active = bets.data.filter((bet) => ["accepted", "edited", "won", "lost", "paid"].includes(bet.status));
    const gross = active.reduce((sum, bet) => sum + bet.amount, 0);
    const payout = active.filter((bet) => bet.status === "won" || bet.status === "paid").reduce((sum, bet) => sum + bet.potentialPayout, 0);
    const highest = [...tallies.data].sort((a, b) => b.potentialPayout - a.potentialPayout)[0];
    return {
      gross,
      payout,
      net: gross - payout,
      count: active.length,
      highest,
      hot: [...tallies.data].sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10),
      winners: active.filter((bet) => bet.status === "won").length,
    };
  }, [bets.data, tallies.data]);

  async function completeDraw() {
    if (!selected) return;
    const winningNumber = window.prompt("Winning number 00-99", selected.winningNumber) ?? "";
    if (!/^\d{1,2}$/.test(winningNumber)) return;
    await api.enterWinningNumber(selected.drawId, winningNumber.padStart(2, "0"));
  }

  async function markPaid(betId: string) {
    await api.markBetPaid(betId);
  }

  async function toggleBlock(number: string, blocked: boolean) {
    if (!selected || readOnlyScope || !canBlock) return;
    if (blocked) {
      await api.unblockNumberForDraw(selected.drawId, number);
      return;
    }
    const reason = window.prompt(`Reason to block ${number}`, "Red number") ?? "";
    if (!reason.trim()) return;
    await api.blockNumberForDraw(selected.drawId, number, reason.trim());
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Operator</span>
          <h2>Live Bets</h2>
        </div>
        {draws.length > 0 && <DrawSelect draws={draws} selectedId={selectedDrawId} setSelectedId={setSelectedDrawId} />}
      </div>
      {operator?.billingStatus === "locked" && <div className="notice danger">Billing is locked. Ushers cannot add bets.</div>}

      {selected ? (
        <>
          <div className="draw-banner">
            <strong>{drawSlotLabel(selected.drawSlot)}</strong>
            <span>Draw {dateTime(selected.drawTime)}</span>
            <span>Cutoff {dateTime(selected.cutoffTime)}</span>
            <span className={`pill ${selected.status}`}>{selected.status}</span>
          </div>
          <div className="metrics">
            <Metric label="Gross stakes" value={money(stats.gross)} />
            <Metric label="Payouts" value={money(stats.payout)} />
            <Metric label="Net estimate" value={money(stats.net)} />
            <Metric label="Bet lines" value={String(stats.count)} />
            <Metric label="Highest exposure" value={stats.highest ? `${stats.highest.number} ${money(stats.highest.potentialPayout)}` : "--"} />
            <Metric label="Winning unpaid" value={String(stats.winners)} />
          </div>
          <div className="actions-row">
            <label className="field inline-field">
              Filter
              <select value={usherFilter} onChange={(event) => setUsherFilter(event.target.value)}>
                <option value="all">All bets</option>
                <option value="direct">Direct operator bets</option>
                {ushers.data.map((usher) => <option key={usher.usherId} value={usher.usherId}>{usher.name}</option>)}
              </select>
            </label>
            {canSettle && <button className="primary" onClick={completeDraw}><CheckCircle size={18} /> Enter winning number</button>}
          </div>
          <div className="dashboard-grid">
            <section className="risk-grid-panel">
              <h3>Number Totals</h3>
              <div className="risk-grid">
                {Array.from({length: 100}, (_, index) => String(index).padStart(2, "0")).map((number) => {
                  const tally = tallies.data.find((item) => item.number === number);
                  const blocked = selected.blockedNumbers.includes(number) || tally?.blocked === true;
                  const hot = Number(tally?.totalAmount ?? 0) > 0;
                  return (
                    <button
                      type="button"
                      className={`risk-cell ${blocked ? "blocked" : hot ? "green" : ""}`}
                      key={number}
                      onClick={() => toggleBlock(number, blocked)}
                      disabled={!canBlock || readOnlyScope}
                      title={blocked ? "Unblock number" : "Block number"}
                    >
                      <strong>{number}</strong>
                      <span>{money(tally?.totalAmount ?? 0)}</span>
                      <span>{money(tally?.potentialPayout ?? 0)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="side-stack">
              <section className="panel">
                <h3>Hot Numbers</h3>
                {stats.hot.map((item) => (
                  <div className="list-row" key={item.number}>
                    <strong>{item.number}</strong>
                    <span>{money(item.totalAmount)} stakes, {money(item.potentialPayout)} payout</span>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h3>Recent Bets</h3>
                {bets.data.slice(0, 12).map((bet) => (
                  <div className="list-row wide" key={bet.betId}>
                    <strong>{bet.number}</strong>
                    <span>{bet.bettorName} - {money(bet.amount)} - {bet.status}</span>
                    {(bet.status === "won" && canSettle) && <button className="icon-button success" onClick={() => markPaid(bet.betId)} title="Mark paid"><Banknote size={18} /></button>}
                  </div>
                ))}
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="notice">No draws available. Create today's fixed draws from Draws.</div>
      )}
    </section>
  );
}

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
