import {CheckCircle, XCircle} from "lucide-react";
import {useMemo, useState} from "react";
import {DrawSelect} from "../components/DrawSelect";
import {api, usePendingBets, useRecentBets, useTallies} from "../lib/data";
import {dateTime, money} from "../lib/format";
import type {Draw, Tally} from "../lib/types";
import {NumberDetail} from "./NumberDetail";

interface AdminDashboardProps {
  draws: Draw[];
  selectedDrawId: string;
  setSelectedDrawId: (id: string) => void;
}

export function AdminDashboard({draws, selectedDrawId, setSelectedDrawId}: AdminDashboardProps) {
  const selected = draws.find((draw) => draw.drawId === selectedDrawId);
  const tallies = useTallies(selected?.drawId);
  const recent = useRecentBets(selected?.drawId, undefined, true);
  const pending = usePendingBets(selected?.drawId);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  const stats = useMemo(() => {
    const highest = [...tallies.data].sort((a, b) => b.exposure - a.exposure);
    return {
      totalSales: tallies.data.reduce((sum, item) => sum + item.totalAmount, 0),
      acceptedBets: tallies.data.reduce((sum, item) => sum + item.betCount, 0),
      redCount: tallies.data.filter((item) => item.riskStatus === "red" || item.blocked).length,
      highest: highest[0],
      hot: highest.slice(0, 10),
    };
  }, [tallies.data]);

  async function approve(betId: string) {
    await api.approveBet(betId);
  }

  async function reject(betId: string) {
    const reason = window.prompt("Reason for rejection") ?? "Rejected by admin";
    await api.rejectBet(betId, reason);
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Risk Dashboard</h2>
        </div>
        {draws.length > 0 && <DrawSelect draws={draws} selectedId={selectedDrawId} setSelectedId={setSelectedDrawId} />}
      </div>

      {selected ? (
        <>
          <div className="draw-banner">
            <strong>{selected.gameType}</strong>
            <span>Draw {dateTime(selected.drawTime)}</span>
            <span>Cutoff {dateTime(selected.cutoffTime)}</span>
            <span className={`pill ${selected.status}`}>{selected.status}</span>
          </div>
          <div className="metrics">
            <Metric label="Total sales" value={money(stats.totalSales)} />
            <Metric label="Accepted bets" value={String(stats.acceptedBets)} />
            <Metric label="Highest number" value={stats.highest?.number ?? "--"} />
            <Metric label="Highest exposure" value={money(stats.highest?.exposure ?? 0)} />
            <Metric label="Red or blocked" value={String(stats.redCount)} />
            <Metric label="Pending approval" value={String(pending.data.length)} />
          </div>
          <div className="dashboard-grid">
            <div className="risk-grid-panel">
              <h3>00-99 Risk Grid</h3>
              <div className="risk-grid">
                {Array.from({length: 100}, (_, index) => String(index).padStart(2, "0")).map((number) => {
                  const tally = tallies.data.find((item) => item.number === number) ?? emptyTally(number);
                  const status = tally.blocked ? "blocked" : tally.riskStatus;
                  return (
                    <button className={`risk-cell ${status}`} key={number} onClick={() => setSelectedNumber(number)}>
                      <strong>{number}</strong>
                      <span>{money(tally.totalAmount)}</span>
                      <span>{money(tally.exposure)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="side-stack">
              <section className="panel">
                <h3>Pending Approvals</h3>
                {pending.data.map((bet) => (
                  <div className="approval-row" key={bet.betId}>
                    <div>
                      <strong>{bet.number}</strong>
                      <span>{money(bet.amount)} · exposure {money(bet.exposure)}</span>
                    </div>
                    <button className="icon-button success" onClick={() => approve(bet.betId)} title="Approve"><CheckCircle size={18} /></button>
                    <button className="icon-button danger" onClick={() => reject(bet.betId)} title="Reject"><XCircle size={18} /></button>
                  </div>
                ))}
                {pending.data.length === 0 && <p className="muted">No pending bets.</p>}
              </section>
              <section className="panel">
                <h3>Hot Numbers</h3>
                {stats.hot.map((item) => (
                  <div className="list-row" key={item.number}>
                    <strong>{item.number}</strong>
                    <span>{money(item.exposure)}</span>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h3>Recent Bets</h3>
                {recent.data.slice(0, 8).map((bet) => (
                  <div className="list-row" key={bet.betId}>
                    <strong>{bet.number}</strong>
                    <span>{money(bet.amount)} · {bet.status}</span>
                  </div>
                ))}
              </section>
            </div>
          </div>
          {selectedNumber && <NumberDetail drawId={selected.drawId} number={selectedNumber} close={() => setSelectedNumber(null)} />}
        </>
      ) : (
        <div className="notice">No draws available. Create one from Draws.</div>
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

function emptyTally(number: string): Tally {
  return {number, totalAmount: 0, exposure: 0, betCount: 0, riskLimit: 100000, riskStatus: "green", blocked: false};
}
