import {Lock, Save} from "lucide-react";
import {useState} from "react";
import {useDialog} from "../components/Dialog";
import {Spinner} from "../components/Spinner";
import {useToast} from "../components/Toast";
import {api, useBillingWeeks, useOperator} from "../lib/data";
import {dateTime, money, shortDate} from "../lib/format";
import {statusLabel} from "../lib/labels";
import {errorMessage, useAsyncAction} from "../lib/useAsyncAction";
import type {FeeMode} from "../lib/types";

export function Billing({operatorId, admin}: {operatorId: string; admin: boolean}) {
  const operator = useOperator(operatorId);
  const billing = useBillingWeeks(operatorId, admin);
  const dialog = useDialog();
  const toast = useToast();
  const saveAction = useAsyncAction();
  const computeAction = useAsyncAction();
  const lockAction = useAsyncAction();
  const [feeMode, setFeeMode] = useState<FeeMode>("netDailyIncome");
  const [feePercent, setFeePercent] = useState("0");
  const [feePerUsher, setFeePerUsher] = useState("0");
  const [billingStatus, setBillingStatus] = useState("active");
  const [paying, setPaying] = useState("");

  async function save() {
    if (!operator.data) return;
    await saveAction.run(
      () =>
        api.updateOperatorBilling({
          operatorId,
          billingStatus,
          feeMode,
          feePercent: Number(feePercent),
          feePerUsher: Number(feePerUsher),
          lockReason: billingStatus === "locked" ? "Locked by admin" : "",
        }),
      {success: "Billing settings saved."},
    );
  }

  async function computeWeek() {
    await computeAction.run(() => api.computeWeeklyBilling(operatorId, weekStart(shortDate())), {
      success: "Weekly billing computed.",
    });
  }

  async function lockOverdue() {
    const confirmed = await dialog.confirm({
      title: "Lock all overdue operators?",
      message: "Every operator past their due date will be locked and unable to accept new bets until paid.",
      confirmLabel: "Lock overdue",
      tone: "danger",
    });
    if (!confirmed) return;
    await lockAction.run(() => api.lockOverdueOperators(), {
      onSuccess: (result) => toast.success(`Locked ${result?.locked ?? 0} operator(s).`),
    });
  }

  async function markPaid(billingId: string, week: string) {
    const confirmed = await dialog.confirm({
      title: "Mark billing as paid",
      message: `Confirm payment received for the week of ${week}.`,
      confirmLabel: "Mark paid",
    });
    if (!confirmed) return;
    setPaying(billingId);
    try {
      await api.markBillingPaid(billingId);
      toast.success("Billing week marked as paid.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPaying("");
    }
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Billing</h2>
        </div>
        <button className="primary danger-action" onClick={lockOverdue} disabled={lockAction.busy}>
          {lockAction.busy ? <Spinner /> : <Lock size={18} aria-hidden />}
          {lockAction.busy ? "Locking..." : "Lock overdue"}
        </button>
      </div>
      {operator.data && (
        <div className="tool-panel">
          <h3>{operator.data.name}</h3>
          <div className="form-grid">
            <label>Status
              <select value={billingStatus} onChange={(event) => setBillingStatus(event.target.value)}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
                <option value="locked">Locked</option>
              </select>
            </label>
            <label>Fee mode
              <select value={feeMode} onChange={(event) => setFeeMode(event.target.value as FeeMode)}>
                <option value="netDailyIncome">Net daily income</option>
                <option value="usherBased">Usher based</option>
              </select>
            </label>
            <label>Fee percent<input type="number" min="0" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} /></label>
            <label>Fee per usher<input type="number" min="0" value={feePerUsher} onChange={(event) => setFeePerUsher(event.target.value)} /></label>
          </div>
          <div className="actions-row">
            <button className="primary" onClick={save} disabled={saveAction.busy}>
              {saveAction.busy ? <Spinner /> : <Save size={18} aria-hidden />}
              {saveAction.busy ? "Saving..." : "Save settings"}
            </button>
            <button className="secondary" onClick={computeWeek} disabled={computeAction.busy}>
              {computeAction.busy ? <Spinner /> : null}
              {computeAction.busy ? "Computing..." : "Compute this week"}
            </button>
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
                <td><span className={`pill ${item.status}`}>{statusLabel(item.status)}</span></td>
                <td>
                  {item.status !== "paid" && (
                    <button className="secondary" disabled={paying === item.id} onClick={() => markPaid(item.id, item.weekStartDate)}>
                      {paying === item.id ? <Spinner size={16} /> : null}
                      Mark paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {billing.data.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>No billing weeks yet. Use "Compute this week" to generate one.</td>
              </tr>
            )}
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
