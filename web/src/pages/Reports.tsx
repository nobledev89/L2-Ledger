import {useMemo, useState} from "react";
import {api, useAuditLogs, useBets, useDailyReports, useUshers} from "../lib/data";
import {dateTime, money, shortDate} from "../lib/format";
import type {AppUser} from "../lib/types";

export function Reports({user, operatorId, admin}: {user: AppUser; operatorId: string; admin: boolean}) {
  const [date, setDate] = useState(shortDate());
  const bets = useBets({operatorId, admin});
  const reports = useDailyReports(operatorId, admin);
  const logs = useAuditLogs(operatorId, admin || user.role === "operator");
  const ushers = useUshers(operatorId, admin);
  const summary = useMemo(() => {
    const active = bets.data.filter((bet) => ["accepted", "edited", "won", "lost", "paid"].includes(bet.status));
    const payouts = active.filter((bet) => ["won", "paid"].includes(bet.status)).reduce((sum, bet) => sum + bet.potentialPayout, 0);
    const gross = active.reduce((sum, bet) => sum + bet.amount, 0);
    const byUsher = new Map<string, number>();
    for (const bet of active) byUsher.set(bet.usherId ?? "direct", (byUsher.get(bet.usherId ?? "direct") ?? 0) + bet.amount);
    return {gross, payouts, net: gross - payouts, count: active.length, byUsher};
  }, [bets.data]);

  async function compute() {
    await api.computeDailyReport(operatorId, date);
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{admin ? "Admin" : "Operator"}</span>
          <h2>Reports & Audit</h2>
        </div>
        <div className="actions-row">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="secondary" onClick={compute}>Compute daily</button>
        </div>
      </div>
      <div className="metrics">
        <div className="metric"><span>Gross stakes</span><strong>{money(summary.gross)}</strong></div>
        <div className="metric"><span>Payouts</span><strong>{money(summary.payouts)}</strong></div>
        <div className="metric"><span>Net daily income</span><strong>{money(summary.net)}</strong></div>
        <div className="metric"><span>Bet lines</span><strong>{summary.count}</strong></div>
        <div className="metric"><span>Ushers</span><strong>{ushers.data.length}</strong></div>
        <div className="metric"><span>Reports</span><strong>{reports.data.length}</strong></div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h3>Usher / Direct Totals</h3>
          {[...summary.byUsher.entries()].map(([usherId, amount]) => (
            <div className="list-row" key={usherId}>
              <strong>{usherId === "direct" ? "Direct" : ushers.data.find((usher) => usher.usherId === usherId)?.name ?? usherId}</strong>
              <span>{money(amount)}</span>
            </div>
          ))}
        </section>
        <section className="panel">
          <h3>Daily Reports</h3>
          {reports.data.map((report) => (
            <div className="list-row wide" key={report.id}>
              <strong>{report.date}</strong>
              <span>{money(report.grossStakes)} stakes · {money(report.payouts)} payouts · {money(report.netDailyIncome)} net</span>
            </div>
          ))}
        </section>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {logs.data.map((log) => (
              <tr key={`${log.entityId}-${log.action}-${log.createdAt?.getTime() ?? ""}`}>
                <td>{dateTime(log.createdAt)}</td>
                <td>{log.actorRole} · {log.actorId.slice(0, 8)}</td>
                <td>{log.action}</td>
                <td>{log.entityType} · {log.entityId.slice(0, 12)}</td>
                <td>{log.reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.loading && <div className="notice">Loading audit logs...</div>}
        {logs.error && <div className="notice danger">{logs.error}</div>}
      </div>
    </section>
  );
}
