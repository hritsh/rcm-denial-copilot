import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Header } from "./components/Header";
import { ClaimTable } from "./components/ClaimTable";
import { ClaimModal } from "./components/ClaimModal";
import { AutonomousView } from "./components/AutonomousView";
import { AppContainer } from "./components/layout/AppContainer";
import {
  FOLLOW_UP_OPTIONS,
  STATUS_OPTIONS,
  type AnalysisResult,
  type Claim,
  type StatusUpdateResponse,
} from "./types";
import { fetchJson } from "./utils/api";
import { normalizeClaim } from "./utils/claims";
import { parseAnalysisResult } from "./utils/analysis";

export default function App() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [callScriptVisible, setCallScriptVisible] = useState(false);
  const [statusDraft, setStatusDraft] = useState<string>(STATUS_OPTIONS[0]);
  const [followUpDraft, setFollowUpDraft] = useState<string>(FOLLOW_UP_OPTIONS[0]);
  const [sendLoading, setSendLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [procedureTranslations, setProcedureTranslations] = useState<Record<string, string>>({});
  const [diagnosisTranslations, setDiagnosisTranslations] = useState<Record<string, string>>({});
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const [autonomousMode, setAutonomousMode] = useState(false);

  const manualUpdateRequestRef = useRef(0);

  const analysisRequestRef = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    async function loadClaims() {
      try {
        setIsLoadingClaims(true);
        const data = await fetchJson<Record<string, unknown>[]>("/api/claims");
        setClaims(data.map(normalizeClaim));
        setClaimsError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load claims";
        setClaimsError(message);
      } finally {
        setIsLoadingClaims(false);
      }
    }

    loadClaims();
  }, []);

  useEffect(() => {
    if (!selectedClaim) return;

    manualUpdateRequestRef.current += 1;
    setStatusDraft(selectedClaim.claimStatus || STATUS_OPTIONS[0]);
    setFollowUpDraft(selectedClaim.followUpRequired || FOLLOW_UP_OPTIONS[0]);
    setCallScriptVisible(false);
    setStatusMessage(null);
    setStatusUpdating(false);
  }, [selectedClaim]);

  const actionableClaims = useMemo(
    () => claims.filter((claim) => ["Denied", "Under Review"].includes(claim.claimStatus)),
    [claims]
  );

  const analyzeClaim = useCallback(async (claim: Claim): Promise<AnalysisResult> => {
    const raw = await fetchJson<Record<string, unknown>>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        procedure_code: claim.procedureCode,
        diagnosis_code: claim.diagnosisCode,
        reason_code: claim.reasonCode,
        insurance_type: claim.insuranceType,
      }),
    });

    return parseAnalysisResult(raw);
  }, []);

  function closeModal() {
    analysisRequestRef.current += 1;
    manualUpdateRequestRef.current += 1;
    setSelectedClaim(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalysisLoading(false);
    setStatusMessage(null);
    setCallScriptVisible(false);
    setStatusUpdating(false);
  }

  function applyTranslationToState(kind: "procedure" | "diagnosis", code: string, name: string) {
    if (kind === "procedure") {
      setProcedureTranslations((prev) => ({ ...prev, [code]: name }));
      setClaims((prev) =>
        prev.map((claim) => (claim.procedureCode === code ? { ...claim, procedureName: name } : claim))
      );
      if (selectedClaim?.procedureCode === code) {
        setSelectedClaim((prev) => (prev ? { ...prev, procedureName: name } : prev));
      }
    } else {
      setDiagnosisTranslations((prev) => ({ ...prev, [code]: name }));
      setClaims((prev) =>
        prev.map((claim) => (claim.diagnosisCode === code ? { ...claim, diagnosisName: name } : claim))
      );
      if (selectedClaim?.diagnosisCode === code) {
        setSelectedClaim((prev) => (prev ? { ...prev, diagnosisName: name } : prev));
      }
    }
  }

  async function handleTranslate(
    code: string,
    kind: "procedure" | "diagnosis",
    event?: MouseEvent<HTMLButtonElement>
  ) {
    event?.stopPropagation();
    if (!code) return;

    setTranslatingKey(`${kind}-${code}`);
    setTranslationError(null);

    try {
      const endpoint = kind === "procedure" ? "/api/translate/procedure" : "/api/translate/diagnosis";
      const data = await fetchJson<{ name?: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ code }),
      });

      const name = data.name ?? "No description returned";
      applyTranslationToState(kind, code, name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to translate code";
      setTranslationError(message);
    } finally {
      setTranslatingKey(null);
    }
  }

  async function loadAnalysisForClaim(claim: Claim) {
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setStatusMessage(null);
    setCallScriptVisible(false);

    const requestId = ++analysisRequestRef.current;

    try {
      const result = await analyzeClaim(claim);
      if (analysisRequestRef.current === requestId) {
        setAnalysisResult(result);
      }
    } catch (error) {
      if (analysisRequestRef.current === requestId) {
        const message = error instanceof Error ? error.message : "Unable to analyze claim";
        setAnalysisError(message);
      }
    } finally {
      if (analysisRequestRef.current === requestId) {
        setAnalysisLoading(false);
      }
    }
  }

  function handleSelectClaim(claim: Claim) {
    setSelectedClaim(claim);
    loadAnalysisForClaim(claim);
  }

  function handleRetryAnalysis() {
    if (selectedClaim) {
      loadAnalysisForClaim(selectedClaim);
    }
  }

  const performStatusUpdate = useCallback(
    async (claimId: string, status: string, followUp: string) => {
      const payload = {
        claim_id: claimId,
        claim_status: status,
        follow_up_required: followUp,
      };

      const response = await fetchJson<StatusUpdateResponse>("/api/claims/status", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const normalized = normalizeClaim(response.claim);
      let enriched: Claim | null = null;

      setClaims((prev) => {
        const match = prev.find((claim) => claim.claimId === normalized.claimId);
        if (!match) {
          enriched = {
            ...normalized,
            procedureName: procedureTranslations[normalized.procedureCode],
            diagnosisName: diagnosisTranslations[normalized.diagnosisCode],
          };
          return prev;
        }

        enriched = {
          ...normalized,
          procedureName: match.procedureName ?? procedureTranslations[normalized.procedureCode],
          diagnosisName: match.diagnosisName ?? diagnosisTranslations[normalized.diagnosisCode],
        };

        return prev.map((claim) => (claim.claimId === enriched!.claimId ? enriched! : claim));
      });

      const resolved =
        enriched ?? {
          ...normalized,
          procedureName: procedureTranslations[normalized.procedureCode],
          diagnosisName: diagnosisTranslations[normalized.diagnosisCode],
        };

      if (selectedClaim?.claimId === resolved.claimId) {
        setSelectedClaim(resolved);
        setStatusDraft(resolved.claimStatus || STATUS_OPTIONS[0]);
        setFollowUpDraft(resolved.followUpRequired || FOLLOW_UP_OPTIONS[0]);
      }

      return resolved;
    },
    [diagnosisTranslations, procedureTranslations, selectedClaim]
  );

  async function handleSendRecommended() {
    if (!selectedClaim || !analysisResult) return;

    setSendLoading(true);
    setStatusMessage(null);

    try {
      const updated = await performStatusUpdate(
        selectedClaim.claimId,
        analysisResult.suggested_status,
        followUpDraft
      );
      setStatusMessage(`Sent to ${analysisResult.suggested_team}. Status is now "${updated.claimStatus}".`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send recommendation";
      setStatusMessage(message);
    } finally {
      setSendLoading(false);
    }
  }

  const updateManualStatus = useCallback(
    async (nextStatus: string, nextFollowUp: string) => {
      if (!selectedClaim) return;

      const requestId = ++manualUpdateRequestRef.current;
      setStatusUpdating(true);
      setStatusMessage(null);

      try {
        const updated = await performStatusUpdate(selectedClaim.claimId, nextStatus, nextFollowUp);
        if (manualUpdateRequestRef.current === requestId) {
          setStatusMessage(`Status changed to "${updated.claimStatus}".`);
        }
      } catch (error) {
        if (manualUpdateRequestRef.current === requestId) {
          const message = error instanceof Error ? error.message : "Unable to update status";
          setStatusMessage(message);
        }
      } finally {
        if (manualUpdateRequestRef.current === requestId) {
          setStatusUpdating(false);
        }
      }
    },
    [selectedClaim, performStatusUpdate]
  );

  function handleFollowUpChange(value: string) {
    setFollowUpDraft(value);
    updateManualStatus(statusDraft, value);
  }

  function handleStatusDraftChange(value: string) {
    setStatusDraft(value);
    updateManualStatus(value, followUpDraft);
  }

  function handleToggleCallScript() {
    setCallScriptVisible((prev) => !prev);
  }

  return (
    <AppContainer>
      <Header autonomousMode={autonomousMode} onAutonomousModeChange={setAutonomousMode} />

      <main>
        {autonomousMode ? (
          <AutonomousView
            claims={claims}
            procedureTranslations={procedureTranslations}
            diagnosisTranslations={diagnosisTranslations}
            translatingKey={translatingKey}
            onTranslate={handleTranslate}
            onAnalyzeClaim={analyzeClaim}
            onPerformStatusUpdate={performStatusUpdate}
          />
        ) : (
          <ClaimTable
            claims={actionableClaims}
            isLoading={isLoadingClaims}
            error={claimsError}
            translatingKey={translatingKey}
            translationError={translationError}
            onTranslate={handleTranslate}
            onSelectClaim={handleSelectClaim}
          />
        )}
      </main>

      <ClaimModal
        claim={selectedClaim}
        open={Boolean(selectedClaim)}
        analysisResult={analysisResult}
        analysisLoading={analysisLoading}
        analysisError={analysisError}
        statusMessage={statusMessage}
        callScriptVisible={callScriptVisible}
        followUpDraft={followUpDraft}
        statusDraft={statusDraft}
        onClose={closeModal}
        onToggleCallScript={handleToggleCallScript}
        onSendRecommended={handleSendRecommended}
        onStatusDraftChange={handleStatusDraftChange}
        onFollowUpChange={handleFollowUpChange}
        onRetryAnalysis={handleRetryAnalysis}
        sendLoading={sendLoading}
        statusUpdating={statusUpdating}
        onTranslate={handleTranslate}
        translatingKey={translatingKey}
      />
    </AppContainer>
  );
}
