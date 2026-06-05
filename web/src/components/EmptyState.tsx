import {Inbox} from "lucide-react";
import type {ReactNode} from "react";

export function EmptyState({title, hint, icon}: {title: string; hint?: string; icon?: ReactNode}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden>
        {icon ?? <Inbox size={22} />}
      </span>
      <strong>{title}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}
