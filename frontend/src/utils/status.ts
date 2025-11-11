import { STATUS_OPTIONS } from "../types";

const STATUS_CLASS_MAP: Record<string, string> = {
    Denied: "border-red-500/40 bg-red-500/10 text-red-200",
    "Under Review": "border-amber-500/40 bg-amber-500/10 text-amber-200",
    Pending: "border-sky-500/40 bg-sky-500/10 text-sky-200",
    "On Hold": "border-violet-500/40 bg-violet-500/10 text-violet-200",
    "In Appeal": "border-orange-500/40 bg-orange-500/10 text-orange-200",
    "In Progress": "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
    Escalated: "border-pink-500/40 bg-pink-500/10 text-pink-200",
    Paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    Resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

const DEFAULT_STATUS_CLASS = "border-muted-foreground/30 bg-muted/40 text-muted-foreground";

export function getStatusClass(status: string): string {
    return STATUS_CLASS_MAP[status] ?? DEFAULT_STATUS_CLASS;
}

export const STATUS_SELECT_OPTIONS = STATUS_OPTIONS.map((status) => ({
    value: status,
    label: status,
}));
