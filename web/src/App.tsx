import {useEffect, useMemo, useState} from "react";
import {Shell, type View} from "./components/Shell";
import {firebaseConfigMissing} from "./lib/firebase";
import {useAuth} from "./lib/useAuth";
import {useDraws} from "./lib/data";
import {Login} from "./pages/Login";
import {AgentEntry} from "./pages/AgentEntry";
import {AgentBets} from "./pages/AgentBets";
import {AdminDashboard} from "./pages/AdminDashboard";
import {DrawManagement} from "./pages/DrawManagement";
import {Reports} from "./pages/Reports";

export function App() {
  const auth = useAuth();
  const draws = useDraws();
  const isAdmin = auth.profile?.role === "admin" || auth.profile?.role === "superAdmin";
  const [view, setView] = useState<View>("agent-entry");
  const openDraws = useMemo(() => draws.data.filter((draw) => draw.status === "open" && draw.cutoffTime.getTime() > Date.now()), [draws.data]);
  const relevantDraws = isAdmin ? draws.data : openDraws;
  const [selectedDrawId, setSelectedDrawId] = useState("");

  useEffect(() => {
    if (auth.profile) setView(isAdmin ? "admin-dashboard" : "agent-entry");
  }, [auth.profile?.uid, isAdmin]);

  useEffect(() => {
    if (!selectedDrawId && relevantDraws[0]) {
      setSelectedDrawId(relevantDraws[0].drawId);
    }
  }, [relevantDraws, selectedDrawId]);

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
      {view === "agent-entry" && <AgentEntry draws={openDraws} selectedDrawId={selectedDrawId} setSelectedDrawId={setSelectedDrawId} />}
      {view === "agent-bets" && <AgentBets agentId={auth.profile.uid} />}
      {view === "admin-dashboard" && <AdminDashboard draws={draws.data} selectedDrawId={selectedDrawId} setSelectedDrawId={setSelectedDrawId} />}
      {view === "draws" && <DrawManagement draws={draws.data} />}
      {view === "reports" && <Reports />}
    </Shell>
  );
}
