import {useEffect, useMemo, useState} from "react";
import {Shell, type View} from "./components/Shell";
import {firebaseConfigMissing} from "./lib/firebase";
import {useAuth} from "./lib/useAuth";
import {useDraws, useOperator, useOperators} from "./lib/data";
import {Login} from "./pages/Login";
import {AgentEntry} from "./pages/AgentEntry";
import {AgentBets} from "./pages/AgentBets";
import {AdminDashboard} from "./pages/AdminDashboard";
import {DrawManagement} from "./pages/DrawManagement";
import {Reports} from "./pages/Reports";
import {OperatorManagement} from "./pages/OperatorManagement";
import {UsherManagement} from "./pages/UsherManagement";
import {Billing} from "./pages/Billing";

export function App() {
  const auth = useAuth();
  const isAdmin = auth.profile?.role === "admin";
  const operators = useOperators(Boolean(isAdmin));
  const [adminOperatorId, setAdminOperatorId] = useState("");
  const operatorId = isAdmin ? adminOperatorId : auth.profile?.operatorId ?? "";
  const operator = useOperator(operatorId);
  const draws = useDraws(operatorId, Boolean(isAdmin && !operatorId));
  const [view, setView] = useState<View>("usher-entry");
  const [selectedDrawId, setSelectedDrawId] = useState("");

  const usableDraws = useMemo(() => {
    if (!auth.profile) return [];
    if (auth.profile.role === "usher") {
      return draws.data.filter((draw) => draw.status === "open" && draw.cutoffTime.getTime() > Date.now());
    }
    return draws.data;
  }, [auth.profile, draws.data]);

  useEffect(() => {
    if (!auth.profile) return;
    setView(auth.profile.role === "admin" ? "admin-operators" : auth.profile.role === "operator" ? "operator-dashboard" : "usher-entry");
  }, [auth.profile?.uid, auth.profile?.role]);

  useEffect(() => {
    if (!adminOperatorId && operators.data[0]) setAdminOperatorId(operators.data[0].operatorId);
  }, [adminOperatorId, operators.data]);

  useEffect(() => {
    if (!selectedDrawId && usableDraws[0]) setSelectedDrawId(usableDraws[0].drawId);
    if (selectedDrawId && usableDraws.length > 0 && !usableDraws.some((draw) => draw.drawId === selectedDrawId)) setSelectedDrawId(usableDraws[0].drawId);
  }, [selectedDrawId, usableDraws]);

  if (auth.loading) return <main className="center-screen">Loading...</main>;

  if (!auth.firebaseUser || !auth.profile) {
    return <Login signIn={auth.signIn} authError={auth.error} configMissing={firebaseConfigMissing} />;
  }

  if (!auth.profile.active) {
    return (
      <main className="center-screen">
        <div className="login-panel">
          <h1>Account inactive</h1>
          <p>Your profile exists but is not active. Contact an administrator.</p>
          <button className="primary" onClick={auth.signOutUser}>Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <Shell user={auth.profile} view={view} setView={setView} signOut={auth.signOutUser}>
      {isAdmin && (
        <div className="admin-scope">
          <label className="field">
            Operator scope
            <select value={adminOperatorId} onChange={(event) => setAdminOperatorId(event.target.value)}>
              {operators.data.map((item) => <option key={item.operatorId} value={item.operatorId}>{item.name}</option>)}
            </select>
          </label>
        </div>
      )}
      {view === "usher-entry" && (
        <AgentEntry
          user={auth.profile}
          operator={operator.data}
          draws={usableDraws}
          selectedDrawId={selectedDrawId}
          setSelectedDrawId={setSelectedDrawId}
        />
      )}
      {view === "usher-bets" && <AgentBets user={auth.profile} />}
      {view === "operator-dashboard" && (
        <AdminDashboard
          user={auth.profile}
          operator={operator.data}
          draws={draws.data}
          selectedDrawId={selectedDrawId}
          setSelectedDrawId={setSelectedDrawId}
        />
      )}
      {view === "draws" && <DrawManagement user={auth.profile} operator={operator.data} draws={draws.data} />}
      {view === "ushers" && <UsherManagement user={auth.profile} operatorId={operatorId} />}
      {view === "reports" && <Reports user={auth.profile} operatorId={operatorId} admin={Boolean(isAdmin)} />}
      {view === "admin-operators" && <OperatorManagement />}
      {view === "admin-billing" && <Billing operatorId={operatorId} admin />}
    </Shell>
  );
}
