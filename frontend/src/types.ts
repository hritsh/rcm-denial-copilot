export const TEAM_OPTIONS = [
    "AR Team",
    "Billing Team",
    "Coding Team",
    "Client Assistance",
    "Payment Team",
] as const;

export const STATUS_OPTIONS = [
    "Denied",
    "Under Review",
    "Pending",
    "On Hold",
    "In Appeal",
    "In Progress",
    "Escalated",
    "Paid",
    "Resolved",
] as const;

export const FOLLOW_UP_OPTIONS = ["Yes", "No"] as const;

export type TeamOption = (typeof TEAM_OPTIONS)[number];

export interface Claim {
    claimId: string;
    providerId: string;
    patientId: string;
    dateOfService: string;
    billedAmount: number;
    procedureCode: string;
    diagnosisCode: string;
    allowedAmount: number;
    paidAmount: number;
    insuranceType: string;
    claimStatus: string;
    reasonCode: string;
    followUpRequired: string;
    arStatus: string;
    outcome: string;
    procedureName?: string;
    diagnosisName?: string;
}

export interface AnalysisResult {
    root_cause: string;
    immediate_steps: string[];
    prevention_focus: string[];
    suggested_team: TeamOption;
    suggested_status: string;
    suggested_code: string | null;
    call_script: string;
}

export interface AutonomousTask {
    claim: Claim;
    result: AnalysisResult;
}

export interface StatusUpdateResponse {
    claim: Record<string, unknown>;
}
