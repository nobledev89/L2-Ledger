import {Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {Spinner} from "../components/Spinner";
import {useToast} from "../components/Toast";
import {api, useUshers} from "../lib/data";
import {money} from "../lib/format";
import {compensationLabel} from "../lib/labels";
import {errorMessage, useAsyncAction} from "../lib/useAsyncAction";
import type {AppUser, CompensationMode, Usher} from "../lib/types";

export function UsherManagement({user, operatorId}: {user: AppUser; operatorId: string}) {
  const ushers = useUshers(operatorId, user.role === "superAdmin");
  const {busy, run} = useAsyncAction();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CompensationMode>("salary");
  const [salary, setSalary] = useState("0");
  const [percentage, setPercentage] = useState("0");

  async function add(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        api.addUsherWithLogin({
          operatorId,
          email,
          password: "Password123",
          name,
          compensationMode: mode,
          salaryAmount: Number(salary),
          percentage: Number(percentage),
        }),
      {
        success: "Usher login created with temporary password Password123.",
        onSuccess: () => {
          setEmail("");
          setName("");
        },
      },
    );
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Operator</span>
          <h2>Ushers</h2>
        </div>
      </div>
      <form className="tool-panel" onSubmit={add}>
        <h3>Add usher</h3>
        <div className="form-grid">
          <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Compensation
            <select value={mode} onChange={(event) => setMode(event.target.value as CompensationMode)}>
              <option value="salary">Salary</option>
              <option value="salaryPlusPercentage">Salary + percentage</option>
            </select>
          </label>
          <label>Salary<input type="number" min="0" value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
          <label>Percentage<input type="number" min="0" max="100" value={percentage} onChange={(event) => setPercentage(event.target.value)} /></label>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? <Spinner /> : <Save size={18} aria-hidden />}
          {busy ? "Adding..." : "Add usher"}
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>User UID</th>
              <th>Mode</th>
              <th>Salary</th>
              <th>Percent</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {ushers.data.map((usher) => (
              <UsherRow key={usher.usherId} usher={usher} />
            ))}
            {ushers.data.length === 0 && (
              <tr className="empty-row">
                <td colSpan={6}>No ushers yet. Add one using the form above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsherRow({usher}: {usher: Usher}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function setActive(active: boolean) {
    setSaving(true);
    try {
      await api.updateUsher({
        usherId: usher.usherId,
        active,
        compensationMode: usher.compensationMode,
        salaryAmount: usher.salaryAmount,
        percentage: usher.percentage,
      });
      toast.success(`${usher.name || "Usher"} ${active ? "activated" : "deactivated"}.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td>{usher.name}</td>
      <td>{usher.userId}</td>
      <td>{compensationLabel(usher.compensationMode)}</td>
      <td>{money(usher.salaryAmount)}</td>
      <td>{usher.percentage}%</td>
      <td>
        <label className="switch">
          <input
            type="checkbox"
            checked={usher.active}
            disabled={saving}
            onChange={(event) => setActive(event.target.checked)}
            aria-label={`${usher.name || "Usher"} active`}
          />
          <span className="switch-track" aria-hidden />
        </label>
      </td>
    </tr>
  );
}
