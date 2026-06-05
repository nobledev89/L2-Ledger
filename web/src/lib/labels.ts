const ROLE_LABELS: Record<string, string> = {
  usher: "Usher",
  manager: "Manager",
  coOperator: "Co-operator",
  operator: "Operator",
  superAdmin: "Super Admin",
};

const STATUS_LABELS: Record<string, string> = {
  pendingSync: "Pending sync",
  accepted: "Accepted",
  edited: "Edited",
  cancelled: "Cancelled",
  won: "Won",
  lost: "Lost",
  paid: "Paid",
  rejected: "Rejected",
  open: "Open",
  locked: "Locked",
  completed: "Completed",
  trial: "Trial",
  active: "Active",
  due: "Due",
  overdue: "Overdue",
  voided: "Voided",
  pendingApproval: "Pending approval",
  voidRequested: "Void requested",
};

const FEE_MODE_LABELS: Record<string, string> = {
  netDailyIncome: "Net daily income",
  usherBased: "Usher based",
};

const COMPENSATION_LABELS: Record<string, string> = {
  salary: "Salary",
  salaryPlusPercentage: "Salary + percentage",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function feeModeLabel(mode: string): string {
  return FEE_MODE_LABELS[mode] ?? mode;
}

export function compensationLabel(mode: string): string {
  return COMPENSATION_LABELS[mode] ?? mode;
}
