import {Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {api, useUshers} from "../lib/data";
import {money} from "../lib/format";
import type {AppUser, CompensationMode} from "../lib/types";

export function UsherManagement({user, operatorId}: {user: AppUser; operatorId: string}) {
  const ushers = useUshers(operatorId, user.role === "admin");
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CompensationMode>("salary");
  const [salary, setSalary] = useState("0");
  const [percentage, setPercentage] = useState("0");
  const [message, setMessage] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await api.addUsher({operatorId, userId, name, compensationMode: mode, salaryAmount: Number(salary), percentage: Number(percentage)});
    setUserId("");
    setName("");
    setMessage("Usher added.");
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
          <label>User UID<input value={userId} onChange={(event) => setUserId(event.target.value)} /></label>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Compensation
            <select value={mode} onChange={(event) => setMode(event.target.value as CompensationMode)}>
              <option value="salary">salary</option>
              <option value="salaryPlusPercentage">salary plus percentage</option>
            </select>
          </label>
          <label>Salary<input type="number" min="0" value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
          <label>Percentage<input type="number" min="0" max="100" value={percentage} onChange={(event) => setPercentage(event.target.value)} /></label>
        </div>
        {message && <div className="notice">{message}</div>}
        <button className="primary"><Save size={18} /> Add usher</button>
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
              <tr key={usher.usherId}>
                <td>{usher.name}</td>
                <td>{usher.userId}</td>
                <td>{usher.compensationMode}</td>
                <td>{money(usher.salaryAmount)}</td>
                <td>{usher.percentage}%</td>
                <td>
                  <input
                    type="checkbox"
                    checked={usher.active}
                    onChange={(event) => api.updateUsher({
                      usherId: usher.usherId,
                      active: event.target.checked,
                      compensationMode: usher.compensationMode,
                      salaryAmount: usher.salaryAmount,
                      percentage: usher.percentage,
                    })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
