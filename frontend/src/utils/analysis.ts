import type { AnalysisResult, TeamOption } from "../types";
import { TEAM_OPTIONS } from "../types";

function coerceList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
    if (typeof value === "string" && value.trim()) {
        return [value.trim()];
    }
    return [];
}

function truncate(text: string, length: number): string {
    if (!text) return "";
    if (text.length <= length) return text;
    return `${text.slice(0, length - 1)}…`;
}

export function parseAnalysisResult(raw: Record<string, unknown>): AnalysisResult {
    const root_cause = typeof raw.root_cause === "string" ? truncate(raw.root_cause.trim(), 260) : "";
    const immediate_steps = coerceList(raw.immediate_steps).map((step) => truncate(step, 140)).slice(0, 3);
    const prevention_focus = coerceList(raw.prevention_focus).map((item) => truncate(item, 140)).slice(0, 3);
    const suggested_team_value = typeof raw.suggested_team === "string" ? raw.suggested_team : TEAM_OPTIONS[0];
    const suggested_team: TeamOption = TEAM_OPTIONS.includes(suggested_team_value as TeamOption)
        ? (suggested_team_value as TeamOption)
        : TEAM_OPTIONS[0];
    const suggested_status = typeof raw.suggested_status === "string" ? truncate(raw.suggested_status.trim(), 80) : "In Progress";
    const suggested_code = typeof raw.suggested_code === "string" && raw.suggested_code.trim()
        ? raw.suggested_code.trim()
        : null;
    const call_script = typeof raw.call_script === "string" ? truncate(raw.call_script.trim(), 400) : "";

    return {
        root_cause,
        immediate_steps,
        prevention_focus,
        suggested_team,
        suggested_status,
        suggested_code,
        call_script,
    };
}
