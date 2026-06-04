import {Activity, ClipboardList, Gauge, LogOut, PlusCircle, Settings, ShieldCheck} from "lucide-react";
import type {ReactNode} from "react";
import type {AppUser} from "../lib/types";

export type View = "agent-entry" | "agent-bets" | "admin-dashboard" | "draws" | "reports";

interface ShellProps {
  user: AppUser;
  view: View;
  setView: (view: View) => void;
  signOut: () => void;
  children: ReactNode;
}

export function Shell({user, view, setView, signOut, children}: ShellProps) {
  const isAdmin = user.role === "admin" || user.role === "superAdmin";
  const nav = isAdmin
    ? [
        ["admin-dashboard", Gauge, "Risk"],
        ["draws", Settings, "Draws"],
        ["reports", Activity, "Reports"],
      ]
    : [
        ["agent-entry", PlusCircle, "Entry"],
        ["agent-bets", ClipboardList, "Bets"],
      ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={22} />
          <div>
            <strong>STL Risk Monitor</strong>
            <span>{user.branchId || "main"}</span>
          </div>
        </div>
        <nav>
          {nav.map(([key, Icon, label]) => (
            <button className={view === key ? "active" : ""} key={key as string} onClick={() => setView(key as View)}>
              <Icon size={18} />
              {label as string}
            </button>
          ))}
        </nav>
        <button className="sign-out" onClick={signOut}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{user.role}</span>
            <h1>{user.name || user.email}</h1>
          </div>
          <div className={user.active ? "status ok" : "status danger"}>{user.active ? "Active" : "Inactive"}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
