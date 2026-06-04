import {useMemo} from "react";
import {useAuditLogs, useRecentBets} from "../lib/data";
import {dateTime, money} from "../lib/format";

export function Reports() {
  const bets = useRecentBets(undefined, undefined, true);
  const logs = useAuditLogs();
  const summary = useMemo(
    () => ({
      acceptedSales: bets.data.filter((bet) => bet.status === "accepted").reduce((sum, bet) => sum + bet.amount, 0),
      acceptedExposure: bets.data.filter((bet) => bet.status === "accepted").reduce((sum, bet) => sum + bet.exposure, 0),
      pending: bets.data.filter((bet) => bet.status === "pendingApproval").length,
      rejected: bets.data.filter((bet) => bet.status === "rejected").length,
    }),
    [bets.data],
  );

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Reports & Audit</h2>
        </div>
      </div>
      <div className="metrics">
        <div className="metric"><span>Accepted sales</span><strong>{money(summary.acceptedSales)}</strong></div>
        <div className="metric"><span>Accepted exposure</span><strong>{money(summary.acceptedExposure)}</strong></div>
        <div className="metric"><span>Pending</span><strong>{summary.pending}</strong></div>
        <div className="metric"><span>Rejected</span><strong>{summary.rejected}</strong></div>
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
