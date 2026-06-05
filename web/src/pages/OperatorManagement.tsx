import {Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {useDialog} from "../components/Dialog";
import {Spinner} from "../components/Spinner";
import {api, useOperators} from "../lib/data";
import {dateTime, money} from "../lib/format";
import {statusLabel} from "../lib/labels";
import {useAsyncAction} from "../lib/useAsyncAction";
import type {FeeMode} from "../lib/types";

export function OperatorManagement() {
  const operators = useOperators(true);
  const dialog = useDialog();
  const {busy, run} = useAsyncAction();
  const seeding = useAsyncAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [multiplier, setMultiplier] = useState("400");
  const [feeMode, setFeeMode] = useState<FeeMode>("netDailyIncome");
  const [feePercent, setFeePercent] = useState("0");
  const [feePerUsher, setFeePerUsher] = useState("0");
  const [trialDays, setTrialDays] = useState("7");

  async function add(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        api.addOperatorWithLogin({
          name,
          email,
          password: "Password123",
          contactName,
          contactPhone,
          defaultPayoutMultiplier: Number(multiplier),
          feeMode,
          feePercent: Number(feePercent),
          feePerUsher: Number(feePerUsher),
          trialDays: Number(trialDays),
        }),
      {
        success: "Operator login created with temporary password Password123.",
        onSuccess: () => {
          setName("");
          setEmail("");
          setContactName("");
          setContactPhone("");
        },
      },
    );
  }

  async function seedDemo() {
    const confirmed = await dialog.confirm({
      title: "Seed demo data?",
      message: "This creates sample operators, ushers, and draws in the live database. Use only on a test project.",
      confirmLabel: "Seed demo data",
      tone: "danger",
    });
    if (!confirmed) return;
    await seeding.run(() => api.seedDemoData(), {success: "Demo data seeded. Test password is Password123."});
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Operators</h2>
        </div>
      </div>
      <form className="tool-panel" onSubmit={add}>
        <h3>Add operator</h3>
        <div className="form-grid">
          <label>Operator name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Login email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Contact name<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
          <label>Contact phone<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
          <label>Default multiplier<input type="number" min="1" value={multiplier} onChange={(event) => setMultiplier(event.target.value)} /></label>
          <label>Fee mode
            <select value={feeMode} onChange={(event) => setFeeMode(event.target.value as FeeMode)}>
              <option value="netDailyIncome">Net daily income</option>
              <option value="usherBased">Usher based</option>
            </select>
          </label>
          <label>Fee percent<input type="number" min="0" max="100" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} /></label>
          <label>Fee per usher<input type="number" min="0" value={feePerUsher} onChange={(event) => setFeePerUsher(event.target.value)} /></label>
          <label>Free trial days<input type="number" min="0" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} /></label>
        </div>
        <div className="actions-row">
          <button className="primary" disabled={busy}>
            {busy ? <Spinner /> : <Save size={18} aria-hidden />}
            {busy ? "Adding..." : "Add operator"}
          </button>
          <button className="secondary" type="button" onClick={seedDemo} disabled={seeding.busy}>
            {seeding.busy ? <Spinner /> : null}
            {seeding.busy ? "Seeding..." : "Seed demo data"}
          </button>
        </div>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Trial ends</th>
              <th>Multiplier</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {operators.data.map((operator) => (
              <tr key={operator.operatorId}>
                <td>{operator.name}</td>
                <td>{operator.contactName} {operator.contactPhone}</td>
                <td><span className={`pill ${operator.billingStatus}`}>{statusLabel(operator.billingStatus)}</span></td>
                <td>{dateTime(operator.trialEndsAt)}</td>
                <td>{operator.defaultPayoutMultiplier}</td>
                <td>{operator.feeMode === "netDailyIncome" ? `${operator.feePercent}% net` : `${money(operator.feePerUsher)} per usher`}</td>
              </tr>
            ))}
            {operators.data.length === 0 && (
              <tr className="empty-row">
                <td colSpan={6}>No operators yet. Add one using the form above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
