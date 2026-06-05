import {Save} from "lucide-react";
import {FormEvent, useState} from "react";
import {api, useCoOperators, useManagers} from "../lib/data";
import type {AppUser} from "../lib/types";

export function StaffManagement({user, operatorId}: {user: AppUser; operatorId: string}) {
  const managers = useManagers(operatorId, user.role === "superAdmin");
  const coOperators = useCoOperators(operatorId, user.role === "superAdmin");
  const canAddCoOperator = user.role === "superAdmin" || user.role === "operator";
  const canAddManager = ["superAdmin", "operator", "coOperator"].includes(user.role);
  const [message, setMessage] = useState("");

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Organization</span>
          <h2>Staff</h2>
        </div>
      </div>
      <div className="dashboard-grid">
        {canAddCoOperator && <CoOperatorForm operatorId={operatorId} setMessage={setMessage} />}
        {canAddManager && <ManagerForm operatorId={operatorId} setMessage={setMessage} />}
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="dashboard-grid">
        <section className="panel">
          <h3>Co-operators</h3>
          {coOperators.data.map((item) => (
            <div className="list-row wide" key={item.coOperatorId}>
              <strong>{item.name}</strong>
              <span>{item.email} - {item.sharePercent}% share - {item.active ? "active" : "inactive"}</span>
            </div>
          ))}
          {coOperators.data.length === 0 && <div className="notice">No co-operators.</div>}
        </section>
        <section className="panel">
          <h3>Managers</h3>
          {managers.data.map((item) => (
            <div className="list-row wide" key={item.managerId}>
              <strong>{item.name}</strong>
              <span>{item.email} - {item.active ? "active" : "inactive"}</span>
            </div>
          ))}
          {managers.data.length === 0 && <div className="notice">No managers.</div>}
        </section>
      </div>
    </section>
  );
}

function CoOperatorForm({operatorId, setMessage}: {operatorId: string; setMessage: (value: string) => void}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sharePercent, setSharePercent] = useState("0");

  async function add(event: FormEvent) {
    event.preventDefault();
    await api.addCoOperatorWithLogin({
      operatorId,
      name,
      email,
      password: "Password123",
      contactPhone,
      sharePercent: Number(sharePercent),
    });
    setName("");
    setEmail("");
    setContactPhone("");
    setSharePercent("0");
    setMessage("Co-operator login created with Password123.");
  }

  return (
    <form className="tool-panel" onSubmit={add}>
      <h3>Add co-operator</h3>
      <div className="form-grid">
        <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Phone<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
        <label>Share %<input type="number" min="0" max="100" value={sharePercent} onChange={(event) => setSharePercent(event.target.value)} /></label>
      </div>
      <button className="primary"><Save size={18} /> Add co-operator</button>
    </form>
  );
}

function ManagerForm({operatorId, setMessage}: {operatorId: string; setMessage: (value: string) => void}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    await api.addManagerWithLogin({operatorId, name, email, password: "Password123"});
    setName("");
    setEmail("");
    setMessage("Manager login created with Password123.");
  }

  return (
    <form className="tool-panel" onSubmit={add}>
      <h3>Add manager</h3>
      <div className="form-grid">
        <label>Name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      </div>
      <button className="primary"><Save size={18} /> Add manager</button>
    </form>
  );
}
