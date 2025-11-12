import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult, AutonomousTask, Claim } from "../types";
import { STATUS_OPTIONS } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Spinner } from "./Spinner";
import { getStatusClass } from "../utils/status";
import { cn } from "../lib/utils";
import { ArrowLeft, ArrowRight, Phone } from "lucide-react";

interface AutonomousViewProps {
    claims: Claim[];
    procedureTranslations: Record<string, string>;
    diagnosisTranslations: Record<string, string>;
    translatingKey: string | null;
    onTranslate: (code: string, kind: "procedure" | "diagnosis", event?: MouseEvent<HTMLButtonElement>) =>
        | Promise<void>
        | void;
    onAnalyzeClaim: (claim: Claim) => Promise<AnalysisResult>;
    onPerformStatusUpdate: (claimId: string, status: string, followUp: string) => Promise<Claim>;
}

export function AutonomousView({
    claims,
    procedureTranslations,
    diagnosisTranslations,
    translatingKey,
    onTranslate,
    onAnalyzeClaim,
    onPerformStatusUpdate,
}: AutonomousViewProps) {
    // filter to max 8 denied claims for processing to avoid rate limits
    const deniedClaims = useMemo(() => claims.filter((claim) => claim.claimStatus === "Denied").slice(0, 8), [claims]);


    const [tasks, setTasks] = useState<AutonomousTask[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [callScriptVisible, setCallScriptVisible] = useState<boolean>(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [manualStatus, setManualStatus] = useState<string>(STATUS_OPTIONS[0]);

    const requestRef = useRef(0);
    const tasksRef = useRef<AutonomousTask[]>([]);

    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    useEffect(() => {
        setTasks((prev) => prev.filter((task) => deniedClaims.some((claim) => claim.claimId === task.claim.claimId)));
    }, [deniedClaims]);

    useEffect(() => {
        if (tasks.length === 0) {
            setActiveIndex(0);
            setCallScriptVisible(false);
        } else if (activeIndex >= tasks.length) {
            setActiveIndex(Math.max(tasks.length - 1, 0));
        }
    }, [tasks, activeIndex]);

    useEffect(() => {
        const requestId = ++requestRef.current;
        const existingIds = new Set(tasksRef.current.map((task) => task.claim.claimId));
        const missing = deniedClaims.filter((claim) => !existingIds.has(claim.claimId));

        if (!missing.length) {
            setLoading(false);
            setError((prev) => (tasksRef.current.length === 0 && deniedClaims.length === 0 ? null : prev));
            return () => undefined;
        }

        setLoading(true);
        setError(null);

        (async () => {
            for (const claim of missing) {
                try {
                    const result = await onAnalyzeClaim(claim);
                    if (requestRef.current !== requestId) return;
                    setTasks((prev) => [...prev, { claim, result }]);
                } catch (analysisError) {
                    if (requestRef.current !== requestId) return;
                    const message =
                        analysisError instanceof Error ? analysisError.message : "Unable to analyze denied claim.";
                    setError(message);
                    break;
                }
            }

            if (requestRef.current === requestId) {
                setLoading(false);
            }
        })();

        return () => {
            requestRef.current += 1;
        };
    }, [deniedClaims, onAnalyzeClaim]);

    const activeTask = tasks[activeIndex] ?? null;
    const activeClaim = activeTask
        ? claims.find((claim) => claim.claimId === activeTask.claim.claimId) ?? activeTask.claim
        : null;

    const procedureCode = activeClaim?.procedureCode ?? "";
    const diagnosisCode = activeClaim?.diagnosisCode ?? "";
    const procedureLabel = activeClaim?.procedureName || procedureTranslations[procedureCode];
    const diagnosisLabel = activeClaim?.diagnosisName || diagnosisTranslations[diagnosisCode];
    const procedureTranslating = translatingKey === `procedure-${procedureCode}`;
    const diagnosisTranslating = translatingKey === `diagnosis-${diagnosisCode}`;

    const previousTask = activeIndex > 0 ? tasks[activeIndex - 1] : null;
    const nextTask = activeIndex < tasks.length - 1 ? tasks[activeIndex + 1] : null;

    useEffect(() => {
        if (activeClaim) {
            setManualStatus(activeClaim.claimStatus || STATUS_OPTIONS[0]);
            setCallScriptVisible(false);
        }
    }, [activeClaim]);

    const total = deniedClaims.length;
    const processed = tasks.length;
    const progressValue = total ? Math.min((processed / total) * 100, 100) : 0;
    const remaining = Math.max(total - processed, 0);

    async function handleApplySuggested() {
        if (!activeTask) return;

        setProcessingId(activeTask.claim.claimId);
        setError(null);

        try {
            await onPerformStatusUpdate(
                activeTask.claim.claimId,
                activeTask.result.suggested_status,
                activeTask.claim.followUpRequired || "No"
            );
            setTasks((prev) => {
                const updated = prev.filter((task) => task.claim.claimId !== activeTask.claim.claimId);
                return updated;
            });
            setCallScriptVisible(false);
        } catch (statusError) {
            const message = statusError instanceof Error ? statusError.message : "Unable to apply recommendation.";
            setError(message);
        } finally {
            setProcessingId(null);
        }
    }

    async function applyManualStatus(nextStatus: string) {
        if (!activeTask || !nextStatus) return;

        setProcessingId(activeTask.claim.claimId);
        setError(null);

        try {
            await onPerformStatusUpdate(activeTask.claim.claimId, nextStatus, activeTask.claim.followUpRequired || "No");
            setTasks((prev) => prev.filter((task) => task.claim.claimId !== activeTask.claim.claimId));
            setCallScriptVisible(false);
        } catch (statusError) {
            const message = statusError instanceof Error ? statusError.message : "Unable to update status.";
            setError(message);
        } finally {
            setProcessingId(null);
        }
    }

    function handleManualStatusChange(value: string) {
        setManualStatus(value);
        void applyManualStatus(value);
    }

    function handleToggleCallScript() {
        setCallScriptVisible((prev) => !prev);
    }

    function handleSkip() {
        setTasks((prev) => {
            if (prev.length <= 1) {
                return prev;
            }
            const updated = [...prev];
            const [current] = updated.splice(activeIndex, 1);
            updated.push(current);
            const nextIndex = Math.min(activeIndex, updated.length - 1);
            setActiveIndex(nextIndex);
            setCallScriptVisible(false);
            return updated;
        });
    }

    function handleSelect(index: number) {
        setActiveIndex(index);
        setCallScriptVisible(false);
    }

    return (
        <div className="space-y-6">
            <Card className="border border-border/60 bg-card/60 text-card-foreground shadow-lg">
                <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <CardTitle className="text-xl font-semibold">AI Work Queue</CardTitle>
                        <CardDescription>
                            Reviewing denied claims automatically. Approve or adjust the recommended updates.
                        </CardDescription>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Processed {processed} / {total}</span>
                            <span>{remaining} remaining</span>
                        </div>
                        <Progress value={progressValue} className="h-2" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {loading && tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                            <Spinner size="lg" />
                            <p className="text-sm">Analyzing denied claims…</p>
                        </div>
                    ) : !activeTask ? (
                        <div className="py-20 text-center text-sm text-muted-foreground">
                            No denied claims available for autonomous review.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-sm text-muted-foreground">
                                    Task {activeIndex + 1} of {tasks.length}
                                </span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSelect(Math.max(activeIndex - 1, 0))}
                                        disabled={activeIndex === 0}
                                        className="gap-1"
                                    >
                                        <ArrowLeft className="size-3.5" /> Previous
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSelect(Math.min(activeIndex + 1, tasks.length - 1))}
                                        disabled={activeIndex >= tasks.length - 1}
                                        className="gap-1"
                                    >
                                        Next <ArrowRight className="size-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                            Claim #{activeClaim?.claimId}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                            Patient #{activeClaim?.patientId}
                                        </Badge>
                                        <Badge variant="outline" className={cn("border", getStatusClass(activeClaim?.claimStatus ?? ""))}>
                                            {activeClaim?.claimStatus ?? "Unknown"}
                                        </Badge>
                                    </div>

                                    <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                                        <h3 className="text-sm font-semibold text-muted-foreground">Root Cause</h3>
                                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{activeTask.result.root_cause}</p>
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Immediate steps</h4>
                                            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-foreground/90">
                                                {activeTask.result.immediate_steps.map((step, index) => (
                                                    <li key={step + index}>{step}</li>
                                                ))}
                                            </ol>
                                        </div>
                                        <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prevention focus</h4>
                                            <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-foreground/90">
                                                {activeTask.result.prevention_focus.map((item, index) => (
                                                    <li key={item + index}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            <span className="text-muted-foreground">Recommended team</span>
                                            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                                                {activeTask.result.suggested_team}
                                            </Badge>
                                            <span className="text-muted-foreground">Status</span>
                                            <Badge
                                                variant="outline"
                                                className={cn("border", getStatusClass(activeTask.result.suggested_status))}
                                            >
                                                {activeTask.result.suggested_status}
                                            </Badge>
                                            {activeTask.result.suggested_code && (
                                                <Badge variant="outline" className="border-amber-400/40 bg-amber-500/10 text-amber-200">
                                                    Code: {activeTask.result.suggested_code}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-foreground">Procedure:</span>
                                                <span className="font-mono text-xs text-foreground/80">{procedureCode}</span>
                                                {procedureLabel ? (
                                                    <Badge variant="outline" className="border-emerald-500/60 bg-emerald-500/15 text-emerald-100">
                                                        {procedureLabel}
                                                    </Badge>
                                                ) : null}
                                                {procedureCode && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => onTranslate(procedureCode, "procedure")}
                                                        disabled={procedureTranslating}
                                                    >
                                                        {procedureTranslating && <Spinner className="mr-2" size="xs" />}
                                                        Translate
                                                    </Button>
                                                )}
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-foreground">Diagnosis:</span>
                                                <span className="font-mono text-xs text-foreground/80">{diagnosisCode}</span>
                                                {diagnosisLabel ? (
                                                    <Badge variant="outline" className="border-emerald-500/60 bg-emerald-500/15 text-emerald-100">
                                                        {diagnosisLabel}
                                                    </Badge>
                                                ) : null}
                                                {diagnosisCode && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={() => onTranslate(diagnosisCode, "diagnosis")}
                                                        disabled={diagnosisTranslating}
                                                    >
                                                        {diagnosisTranslating && <Spinner className="mr-2" size="xs" />}
                                                        Translate
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="mt-1">
                                                <span className="font-medium text-foreground">Reason:</span> {activeClaim?.reasonCode}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                                            <p>
                                                <span className="font-medium text-foreground">Follow-up required:</span> {" "}
                                                {activeClaim?.followUpRequired || "—"}
                                            </p>
                                            <p className="mt-1">
                                                <span className="font-medium text-foreground">Insurance:</span> {" "}
                                                {activeClaim?.insuranceType}
                                            </p>
                                            <p className="mt-1">
                                                <span className="font-medium text-foreground">Billed:</span> ${" "}
                                                {activeClaim?.billedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                    </div>

                                </div>

                                <div className="space-y-4 rounded-lg border border-border/60 bg-background/40 p-4">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-muted-foreground">Actions</h4>
                                        <Button
                                            className="w-full"
                                            onClick={handleApplySuggested}
                                            disabled={processingId === activeTask.claim.claimId}
                                        >
                                            {processingId === activeTask.claim.claimId ? <Spinner className="mr-2" size="sm" /> : null}
                                            Send to {activeTask.result.suggested_team}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            onClick={handleToggleCallScript}
                                            disabled={!activeTask.result.call_script}
                                        >
                                            {callScriptVisible ? "Hide call script" : "Show call script"}
                                        </Button>
                                        <Button variant="secondary" className="w-full gap-2" disabled>
                                            <Phone className="size-4" /> Call insurance
                                        </Button>
                                        <Button variant="ghost" className="w-full" onClick={handleSkip}>
                                            Skip for now
                                        </Button>
                                    </div>

                                    {callScriptVisible && activeTask.result.call_script && (
                                        <div className="rounded-lg border border-border/60 bg-background/60">
                                            <ScrollArea className="max-h-48">
                                                <div className="p-4 text-sm leading-relaxed text-foreground/90">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                        Call Script
                                                    </h4>
                                                    <p className="mt-2 whitespace-pre-line">{activeTask.result.call_script}</p>
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-muted-foreground">Manual status update</h4>
                                        <Select value={manualStatus} onValueChange={handleManualStatusChange}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-72">
                                                {STATUS_OPTIONS.map((status) => (
                                                    <SelectItem key={status} value={status} className="focus:bg-transparent">
                                                        <Badge variant="outline" className={cn("w-full justify-center", getStatusClass(status))}>
                                                            {status}
                                                        </Badge>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {processingId === activeTask.claim.claimId && (
                                            <div className="flex items-center justify-center gap-2 rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                                <Spinner size="sm" />
                                                <span>Updating status…</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden gap-4 lg:grid lg:grid-cols-3">
                                <div className="rounded-lg border border-dashed border-border/40 bg-background/30 p-4 text-sm text-muted-foreground/70">
                                    {previousTask ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Previous</span>
                                            <span className="font-mono text-sm text-foreground/80">Claim #{previousTask.claim.claimId}</span>
                                            <span>{previousTask.result.suggested_team}</span>
                                        </div>
                                    ) : (
                                        <span>No earlier tasks</span>
                                    )}
                                </div>
                                <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
                                    <span className="text-xs uppercase tracking-wide">Current</span>
                                    <p className="mt-1 font-semibold">Claim #{activeTask.claim.claimId}</p>
                                    <p className="text-xs text-primary/80">{activeTask.result.suggested_team}</p>
                                </div>
                                <div className="rounded-lg border border-dashed border-border/40 bg-background/30 p-4 text-sm text-muted-foreground/70">
                                    {nextTask ? (
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Next</span>
                                            <span className="font-mono text-sm text-foreground/80">Claim #{nextTask.claim.claimId}</span>
                                            <span>{nextTask.result.suggested_team}</span>
                                        </div>
                                    ) : (
                                        <span>No more tasks</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {tasks.length > 0 && (
                <Card className="border border-border/60 bg-muted/30">
                    <CardContent className="py-4">
                        <ScrollArea className="h-14">
                            <div className="flex items-center gap-2">
                                {tasks.map((task, index) => (
                                    <Button
                                        key={task.claim.claimId}
                                        size="sm"
                                        variant={index === activeIndex ? "secondary" : "ghost"}
                                        onClick={() => handleSelect(index)}
                                    >
                                        #{task.claim.claimId}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
