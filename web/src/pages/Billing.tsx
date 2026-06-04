import {Lock, Save} from "lucide-react";
import {useState} from "react";
import {api, useBillingWeeks, useOperator} from "../lib/data";
import {dateTime, money, shortDate} from "../lib/format";
import type {FeeMode} from "../lib/types";

export function Billing({operatorId, admin}: {operatorId: string; admin: boolean}) {
  const operator = useOperator(operatorId);
  const billing = useBillingWeeks(operatorId, admin);
  const [feeMode, setFeeMode] = useState<FeeMode>("netDailyIncome");
  const [feePercent, setFeePercent] = useState("0");
  const [feePerUsher, setFeePerUsher] = useState("0");
  const [billingStatus, setBillingStatus] = useState("active");
  const [message, setMessage] = useState("");

  async function save() {
    if (!operator.data) return;
    await api.updateOperatorBilling({
      operatorId,
      billingStatus,
      feeMode,
      feePercent: Number(feePercent),
      feePerUsher: Number(feePerUsher),
      lockReason: billingStatus === "locked" ? "Locked by admin" : "",
    });
    setMessage("Billing settings saved.");
  }

  async function computeWeek() {
    await api.computeWeeklyBilling(operatorId, weekStart(shortDate()));
    setMessage("Weekly billing computed.");
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Billing</h2>
        </div>
        <button className="primary" onClick={() => api.lockOverdueOperators()}><Lock size={18} /> Lock overdue</button>
      </div>
      {operator.data && (
        <div className="tool-panel">
          <h3>{operator.data.name}</h3>
          <div className="form-grid">
            <label>Status
              <select value={billingStatus} onChange={(event) => setBillingStatus(event.target.value)}>
                <option value="trial">trial</option>
                <option value="active">active</option>
                <option value="due">due</option>
                <option value="overdue">overdue</option>
                <option value="locked">locked</option>
              </select>
            </label>
            <label>Fee mode
              <select value={feeMode} onChange={(event) => setFeeMode(event.target.value as FeeMode)}>
                <option value="netDailyIncome">net daily income</option>
                <option value="usherBased">usher based</option>
              </select>
            </label>
            <label>Fee percent<input type="number" min="0" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} /></label>
            <label>Fee per usher<input type="number" min="0" value={feePerUsher} onChange={(event) => setFeePerUsher(event.target.value)} /></label>
          </div>
          {message && <div className="notice">{message}</div>}
          <div className="actions-row">
            <button className="primary" onClick={save}><Save size={18} /> Save settings</button>
            <button className="secondary" onClick={computeWeek}>Compute this week</button>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Friday cutoff</th>
              <th>Due Sunday</th>
              <th>Net income</th>
              <th>Admin fee</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {billing.data.map((item) => (
              <tr key={item.id}>
                <td>{item.weekStartDate}</td>
                <td>{dateTime(item.fridayCutoffAt)}</td>
                <td>{dateTime(item.dueDateSunday)}</td>
                <td>{money(item.totalNetDailyIncome)}</td>
                <td>{money(item.totalAdminFee)}</td>
                <td><span className={`pill ${item.status}`}>{item.status}</span></td>
                <td>{item.status !== "paid" && <button className="secondary" onClick={() => api.markBillingPaid(item.id)}>Mark paid</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00+08:00`);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  return value.toISOString().slice(0, 10);
}
