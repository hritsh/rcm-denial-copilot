import type { MouseEvent } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ScrollArea } from "./ui/scroll-area";
import { Spinner } from "./Spinner";
import { Phone } from "lucide-react";
import type { AnalysisResult, Claim } from "../types";
import { FOLLOW_UP_OPTIONS, STATUS_OPTIONS } from "../types";
import { formatCurrency } from "../utils/format";
import { getStatusClass } from "../utils/status";
import { cn } from "../lib/utils";

interface ClaimModalProps {
    claim: Claim | null;
    open: boolean;
    analysisResult: AnalysisResult | null;
    analysisLoading: boolean;
    analysisError: string | null;
    statusMessage: string | null;
    callScriptVisible: boolean;
    followUpDraft: string;
    statusDraft: string;
    onClose: () => void;
    onToggleCallScript: () => void;
    onSendRecommended: () => void;
    onStatusDraftChange: (value: string) => void;
    onFollowUpChange: (value: string) => void;
    onRetryAnalysis: () => void;
    sendLoading: boolean;
    statusUpdating: boolean;
    onTranslate: (code: string, kind: "procedure" | "diagnosis", event?: MouseEvent<HTMLButtonElement>) =>
        | Promise<void>
        | void;
    translatingKey: string | null;
}

export function ClaimModal({
    claim,
    open,
    analysisResult,
    analysisLoading,
    analysisError,
    statusMessage,
    callScriptVisible,
    followUpDraft,
    statusDraft,
    onClose,
    onToggleCallScript,
    onSendRecommended,
    onStatusDraftChange,
    onFollowUpChange,
    onRetryAnalysis,
    sendLoading,
    statusUpdating,
    onTranslate,
    translatingKey,
}: ClaimModalProps) {
    if (!claim) {
        return null;
    }

    const detailBlocks = [
        { label: "Claim ID", value: claim.claimId },
        { label: "Provider", value: claim.providerId },
        { label: "Patient", value: claim.patientId },
        { label: "Date of Service", value: claim.dateOfService },
        { label: "Billed", value: formatCurrency(claim.billedAmount) },
        { label: "Allowed", value: formatCurrency(claim.allowedAmount) },
        { label: "Paid", value: formatCurrency(claim.paidAmount) },
        { label: "Insurance", value: claim.insuranceType },
        { label: "Reason Code", value: claim.reasonCode },
        { label: "AR Status", value: claim.arStatus || "—" },
        { label: "Outcome", value: claim.outcome || "—" },
    ];

    const followUpBadgeClass = claim.followUpRequired === "Yes"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
        : "border-muted-foreground/30 bg-muted/40 text-muted-foreground";

    const statusOptionClasses = (status: string) =>
        cn("w-full justify-start text-left", getStatusClass(status));

    const procedureTranslating = translatingKey === `procedure-${claim.procedureCode}`;
    const diagnosisTranslating = translatingKey === `diagnosis-${claim.diagnosisCode}`;

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
            <DialogContent className="w-full border border-border/60 bg-background/95 p-0 text-foreground sm:max-h-[90vh] sm:w-[85vw] sm:max-w-[85vw] lg:max-w-[80vw] xl:max-w-6xl">
                <div className="flex h-full max-h-[90vh] flex-col">
                    <div className="border-b border-border/40 bg-background/80 px-6 py-5 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Claim #{claim.claimId}</p>
                                <h2 className="text-2xl font-semibold text-foreground">
                                    {claim.reasonCode} · {claim.insuranceType}
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={cn("px-3 py-1 text-xs", getStatusClass(claim.claimStatus))}>
                                    {claim.claimStatus}
                                </Badge>
                                <Badge variant="outline" className={cn("px-3 py-1 text-xs", followUpBadgeClass)}>
                                    Follow-up: {claim.followUpRequired || "—"}
                                </Badge>
                            </div>
                        </div>
                        {statusMessage && (
                            <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary">
                                {statusMessage}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="space-y-6 px-6 py-6">
                            <Card className="border border-border/50 bg-background/70">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold text-muted-foreground">Claim details</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {detailBlocks.map((item) => (
                                            <div
                                                key={item.label}
                                                className="rounded-lg border border-border/40 bg-muted/20 p-3 shadow-sm"
                                            >
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                                                <p className="mt-1 font-semibold text-foreground/90">{item.value}</p>
                                            </div>
                                        ))}
                                        <div className="rounded-lg border border-border/40 bg-emerald-500/10 p-3 shadow-sm">
                                            <p className="text-xs uppercase tracking-wide text-emerald-200">Procedure</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-emerald-100">
                                                <span className="font-mono text-xs">{claim.procedureCode}</span>
                                                {(claim.procedureName) && (
                                                    <Badge variant="outline" className="border-emerald-500/60 bg-emerald-500/20 text-emerald-100">
                                                        {claim.procedureName}
                                                    </Badge>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => onTranslate(claim.procedureCode, "procedure")}
                                                    disabled={procedureTranslating}
                                                >
                                                    {procedureTranslating && <Spinner className="mr-2" size="xs" />}
                                                    Translate
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border border-border/40 bg-sky-500/10 p-3 shadow-sm">
                                            <p className="text-xs uppercase tracking-wide text-sky-200">Diagnosis</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-sky-100">
                                                <span className="font-mono text-xs">{claim.diagnosisCode}</span>
                                                {(claim.diagnosisName) && (
                                                    <Badge variant="outline" className="border-sky-500/60 bg-sky-500/20 text-sky-100">
                                                        {claim.diagnosisName}
                                                    </Badge>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => onTranslate(claim.diagnosisCode, "diagnosis")}
                                                    disabled={diagnosisTranslating}
                                                >
                                                    {diagnosisTranslating && <Spinner className="mr-2" size="xs" />}
                                                    Translate
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border border-border/50 bg-background/70">
                                <CardHeader className="flex flex-col gap-2 pb-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-semibold text-muted-foreground">Denial analysis</CardTitle>
                                        <p className="text-xs text-muted-foreground/80">Insights generated by the autonomous reviewer.</p>
                                    </div>
                                    {analysisLoading && <Spinner size="sm" />}
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {analysisError && (
                                        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                            <div className="flex items-start justify-between gap-3">
                                                <p>{analysisError}</p>
                                                <Button variant="ghost" size="sm" onClick={onRetryAnalysis}>
                                                    Retry
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {analysisResult && !analysisLoading ? (
                                        <div className="space-y-5">
                                            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                                                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm leading-relaxed">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Root cause</h4>
                                                    <p className="mt-2 text-foreground/90">{analysisResult.root_cause}</p>
                                                </div>
                                                <div className="rounded-lg border border-border/50 bg-muted/10 p-4 text-sm">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended team</h5>
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                                                            {analysisResult.suggested_team}
                                                        </Badge>
                                                        <Badge variant="outline" className={cn("px-3 py-1 text-xs", getStatusClass(analysisResult.suggested_status))}>
                                                            {analysisResult.suggested_status}
                                                        </Badge>
                                                        {analysisResult.suggested_code && (
                                                            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-200">
                                                                Code: {analysisResult.suggested_code}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="rounded-lg border border-border/50 bg-background/60 p-4 text-sm">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Immediate steps</h5>
                                                    <ol className="mt-2 list-inside list-decimal space-y-1 text-foreground/90">
                                                        {analysisResult.immediate_steps.map((step, index) => (
                                                            <li key={step + index}>{step}</li>
                                                        ))}
                                                    </ol>
                                                </div>
                                                <div className="rounded-lg border border-border/50 bg-background/60 p-4 text-sm">
                                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prevention focus</h5>
                                                    <ul className="mt-2 list-disc list-inside space-y-1 text-foreground/90">
                                                        {analysisResult.prevention_focus.map((item, index) => (
                                                            <li key={item + index}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-border/50 bg-background/60 p-4">
                                                <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action center</h5>
                                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                                    <Button onClick={onSendRecommended} disabled={sendLoading}>
                                                        {sendLoading && <Spinner className="mr-2" size="sm" />}
                                                        Send to {analysisResult.suggested_team}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        onClick={onToggleCallScript}
                                                        disabled={!analysisResult.call_script}
                                                    >
                                                        {callScriptVisible ? "Hide call script" : "Show call script"}
                                                    </Button>
                                                    <Button variant="secondary" className="gap-2" disabled>
                                                        <Phone className="size-4" /> Call insurance
                                                    </Button>
                                                </div>
                                                {callScriptVisible && analysisResult.call_script && (
                                                    <div className="mt-4 overflow-hidden rounded-md border border-border/40 bg-muted/20">
                                                        <ScrollArea className="max-h-48">
                                                            <div className="whitespace-pre-line p-4 text-sm leading-relaxed text-foreground/90">
                                                                {analysisResult.call_script}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : !analysisLoading && !analysisError ? (
                                        <div className="rounded-md border border-border/40 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                                            Select a claim to fetch analysis insights.
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>

                            <Card className="border border-border/50 bg-background/70">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-sm font-semibold text-muted-foreground">Manual update</CardTitle>
                                    {statusUpdating && <Spinner size="sm" />}
                                </CardHeader>
                                <CardContent className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground">Claim status</label>
                                        <Select value={statusDraft} onValueChange={onStatusDraftChange} disabled={statusUpdating}>
                                            <SelectTrigger className="justify-between">
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-72">
                                                {STATUS_OPTIONS.map((status) => (
                                                    <SelectItem key={status} value={status} className="focus:bg-transparent">
                                                        <Badge variant="outline" className={statusOptionClasses(status)}>
                                                            {status}
                                                        </Badge>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-muted-foreground">Follow-up required</label>
                                        <Select value={followUpDraft} onValueChange={onFollowUpChange} disabled={statusUpdating}>
                                            <SelectTrigger className="justify-between">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {FOLLOW_UP_OPTIONS.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-center",
                                                                option === "Yes"
                                                                    ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                                                                    : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                                                            )}
                                                        >
                                                            {option}
                                                        </Badge>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
