"""FastAPI backend for the RCM Denial Co-pilot application."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional

import google.generativeai as genai
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from pydantic import BaseModel


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GENERATION_MODEL = "gemini-2.5-flash"
CSV_PATH = Path(__file__).parent / "claim_data.csv"
ALLOWED_ORIGINS_RAW = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [origin.strip()
                   for origin in ALLOWED_ORIGINS_RAW.split(",") if origin.strip()]
if not ALLOWED_ORIGINS:
    ALLOWED_ORIGINS = ["*"]

app = FastAPI(title="RCM Denial Co-pilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _configure_gemini() -> genai.GenerativeModel:
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Gemini API key not configured. Set GEMINI_API_KEY in the backend .env file.",
        )

    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel(model_name=GENERATION_MODEL)


MODEL = _configure_gemini() if GEMINI_API_KEY else None


class CodeRequest(BaseModel):
    code: str


class AnalyzeRequest(BaseModel):
    procedure_code: str
    diagnosis_code: str
    reason_code: str
    insurance_type: str


class StatusUpdateRequest(BaseModel):
    claim_id: str
    claim_status: str
    ar_status: Optional[str] = None
    outcome: Optional[str] = None
    follow_up_required: Optional[str] = None


def _clean_json_payload(raw_text: str) -> Dict[str, Any]:
    """Normalize Gemini output into a JSON dict."""

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        segments = cleaned.split("```")
        cleaned = segments[1] if len(segments) > 1 else cleaned

    cleaned = cleaned.strip()
    if cleaned.lower().startswith("json"):
        cleaned = cleaned[4:].strip()

    cleaned = cleaned.strip()

    if not cleaned:
        raise ValueError("Received empty response from Gemini API")

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


def _call_gemini(prompt: str) -> Dict[str, Any]:
    model = MODEL or _configure_gemini()
    try:
        response = model.generate_content(prompt)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(
            status_code=502, detail=f"Gemini API error: {exc}") from exc

    raw = getattr(response, "text", None)
    if not raw:
        raise HTTPException(
            status_code=502, detail="Gemini API returned no content")

    try:
        return _clean_json_payload(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=502, detail=f"Unable to parse Gemini response: {exc}") from exc


@app.get("/api/claims")
async def get_claims() -> Any:
    if not CSV_PATH.exists():
        raise HTTPException(
            status_code=500, detail="Claim data file is missing")

    try:
        df = pd.read_csv(CSV_PATH)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(
            status_code=500, detail=f"Failed to read claim data: {exc}") from exc

    sanitized = df.where(pd.notnull(df), None)
    return sanitized.to_dict(orient="records")


@app.post("/api/translate/procedure")
async def translate_procedure(request: CodeRequest) -> Dict[str, Any]:
    prompt = (
        "You are a medical coding API. You will receive a CPT (procedure) code. "
        "Return a JSON object with the code's common name. "
        "Example input: 99213. Example output: {\"name\": \"Office visit, 15-29 minutes\"}. "
        f"Input: {request.code}. Output:"
    )
    return _call_gemini(prompt)


@app.post("/api/translate/diagnosis")
async def translate_diagnosis(request: CodeRequest) -> Dict[str, Any]:
    prompt = (
        "You are a medical coding API. You will receive an ICD-10 (diagnosis) code. "
        "Return a JSON object with the code's common name. "
        "Example input: A18.6. Example output: {\"name\": \"Tuberculosis of ear\"}. "
        f"Input: {request.code}. Output:"
    )
    return _call_gemini(prompt)


@app.post("/api/analyze")
async def analyze_denial(request: AnalyzeRequest) -> Dict[str, Any]:
    prompt = f"""
You are an expert medical billing auditor API. Analyze the denied claim and respond with concise, structured guidance.
Return ONLY a valid JSON object with exactly these keys:
{{
  "root_cause": "A one or two sentence summary of the denial's primary trigger (<= 250 characters).",
  "immediate_steps": ["Ordered list of 3 concise remediation steps (<= 120 characters each)."],
  "prevention_focus": ["Three short preventative safeguards (<= 120 characters each)."],
  "suggested_team": "One of: AR Team, Billing Team, Coding Team, Client Assistance, Payment Team",
  "suggested_status": "A short status update to apply after action (<= 60 characters).",
  "suggested_code": "Optional CPT/ICD code to resubmit (use null when not applicable).",
  "call_script": "Up to three succinct sentences for a phone call with the payer or client."
}}

If the diagnosis/procedure indicates a coding issue, populate "suggested_code" with the recommended replacement code; otherwise use null.
Keep language direct and action-oriented.

Claim Details:
- Denial Reason: "{request.reason_code}"
- Procedure Billed: "{request.procedure_code}"
- Diagnosis Provided: "{request.diagnosis_code}"
- Insurance Type: "{request.insurance_type}"
"""
    return _call_gemini(prompt)


@app.patch("/api/claims/status")
async def update_claim_status(request: StatusUpdateRequest) -> Dict[str, Any]:
    if not CSV_PATH.exists():
        raise HTTPException(
            status_code=500, detail="Claim data file is missing")

    try:
        df = pd.read_csv(CSV_PATH, dtype=str)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(
            status_code=500, detail=f"Failed to read claim data: {exc}") from exc

    mask = df["Claim ID"] == request.claim_id
    if not mask.any():
        raise HTTPException(
            status_code=404, detail=f"Claim {request.claim_id} not found")

    df.loc[mask, "Claim Status"] = request.claim_status

    if request.ar_status is not None:
        df.loc[mask, "AR Status"] = request.ar_status
    if request.outcome is not None:
        df.loc[mask, "Outcome"] = request.outcome
    if request.follow_up_required is not None:
        df.loc[mask, "Follow-up Required"] = request.follow_up_required

    try:
        df.to_csv(CSV_PATH, index=False)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(
            status_code=500, detail=f"Failed to persist claim update: {exc}") from exc

    updated_record = df.loc[mask].iloc[0].fillna("").to_dict()
    return {"claim": updated_record}


@app.get("/api/health")
async def health_check() -> Dict[str, str]:
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
