import type { Claim } from "../types";

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeClaim(record: Record<string, unknown>): Claim {
    return {
        claimId: String(record["Claim ID"] ?? ""),
        providerId: String(record["Provider ID"] ?? ""),
        patientId: String(record["Patient ID"] ?? ""),
        dateOfService: String(record["Date of Service"] ?? ""),
        billedAmount: toNumber(record["Billed Amount"]),
        procedureCode: String(record["Procedure Code"] ?? ""),
        diagnosisCode: String(record["Diagnosis Code"] ?? ""),
        allowedAmount: toNumber(record["Allowed Amount"]),
        paidAmount: toNumber(record["Paid Amount"]),
        insuranceType: String(record["Insurance Type"] ?? ""),
        claimStatus: String(record["Claim Status"] ?? ""),
        reasonCode: String(record["Reason Code"] ?? ""),
        followUpRequired: String(record["Follow-up Required"] ?? ""),
        arStatus: String(record["AR Status"] ?? ""),
        outcome: String(record["Outcome"] ?? ""),
    };
}
