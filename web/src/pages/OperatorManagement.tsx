import {Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {api, useOperators} from "../lib/data";
import {dateTime, money} from "../lib/format";
import type {FeeMode} from "../lib/types";

export function OperatorManagement() {
  const operators = useOperators(true);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [multiplier, setMultiplier] = useState("400");
  const [feeMode, setFeeMode] = useState<FeeMode>("netDailyIncome");
  const [feePercent, setFeePercent] = useState("0");
  const [feePerUsher, setFeePerUsher] = useState("0");
  const [trialDays, setTrialDays] = useState("7");
  const [message, setMessage] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await api.addOperator({
      name,
      contactName,
      contactPhone,
      defaultPayoutMultiplier: Number(multiplier),
      feeMode,
      feePercent: Number(feePercent),
      feePerUsher: Number(feePerUsher),
      trialDays: Number(trialDays),
    });
    setName("");
    setContactName("");
    setContactPhone("");
    setMessage("Operator added.");
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
          <label>Operator name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Contact name<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
          <label>Contact phone<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
          <label>Default multiplier<input type="number" min="1" value={multiplier} onChange={(event) => setMultiplier(event.target.value)} /></label>
          <label>Fee mode
            <select value={feeMode} onChange={(event) => setFeeMode(event.target.value as FeeMode)}>
              <option value="netDailyIncome">net daily income</option>
              <option value="usherBased">usher based</option>
            </select>
          </label>
          <label>Fee percent<input type="number" min="0" max="100" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} /></label>
          <label>Fee per usher<input type="number" min="0" value={feePerUsher} onChange={(event) => setFeePerUsher(event.target.value)} /></label>
          <label>Free trial days<input type="number" min="0" value={trialDays} onChange={(event) => setTrialDays(event.target.value)} /></label>
        </div>
        {message && <div className="notice">{message}</div>}
        <button className="primary"><Save size={18} /> Add operator</button>
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
                <td><span className={`pill ${operator.billingStatus}`}>{operator.billingStatus}</span></td>
                <td>{dateTime(operator.trialEndsAt)}</td>
                <td>{operator.defaultPayoutMultiplier}</td>
                <td>{operator.feeMode === "netDailyIncome" ? `${operator.feePercent}% net` : `${money(operator.feePerUsher)} per usher`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
