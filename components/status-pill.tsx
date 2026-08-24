export type PillStatus = "active" | "idle" | "needs_review" | "pending" | "matched" | "missed";

const STYLES: Record<PillStatus, string> = {
  active: "bg-accent-soft text-accent-ink",
  idle: "bg-line text-ink-faint",
  needs_review: "bg-warn-soft text-warn",
  pending: "bg-line text-ink-faint",
  matched: "bg-accent-soft text-accent-ink",
  missed: "bg-danger-soft text-danger",
};

const LABELS: Record<PillStatus, string> = {
  active: "Active",
  idle: "Idle",
  needs_review: "Needs Review",
  pending: "Pending",
  matched: "Matched",
  missed: "Missed",
};

export default function StatusPill({ status }: { status: PillStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
