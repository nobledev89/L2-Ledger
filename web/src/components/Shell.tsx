import {Activity, ClipboardList, CreditCard, LayoutDashboard, LogOut, PlusCircle, Settings, ShieldCheck, UserCog, Users} from "lucide-react";
import type {ReactNode} from "react";
import type {AppUser} from "../lib/types";

export type View = "usher-entry" | "usher-bets" | "operator-dashboard" | "draws" | "staff" | "ushers" | "reports" | "admin-operators" | "admin-billing";

interface ShellProps {
  user: AppUser;
  view: View;
  setView: (view: View) => void;
  signOut: () => void;
  children: ReactNode;
}

export function Shell({user, view, setView, signOut, children}: ShellProps) {
  const nav =
    user.role === "superAdmin"
      ? [
          ["admin-operators", ShieldCheck, "Operators"],
          ["admin-billing", CreditCard, "Billing"],
          ["reports", Activity, "Reports"],
        ]
      : ["operator", "coOperator"].includes(user.role)
        ? [
            ["operator-dashboard", LayoutDashboard, "Live"],
            ["usher-entry", PlusCircle, "Direct"],
            ["draws", Settings, "Draws"],
            ["staff", UserCog, "Staff"],
            ["ushers", Users, "Ushers"],
            ["reports", Activity, "Reports"],
          ]
        : user.role === "manager"
          ? [
              ["operator-dashboard", LayoutDashboard, "Live"],
              ["usher-entry", PlusCircle, "Direct"],
              ["draws", Settings, "Draws"],
              ["ushers", Users, "Ushers"],
              ["reports", Activity, "Reports"],
            ]
          : [
            ["usher-entry", PlusCircle, "Entry"],
            ["usher-bets", ClipboardList, "Bets"],
            ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={22} />
          <div>
            <strong>STL Operations</strong>
            <span>{user.operatorId || "platform"}</span>
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
