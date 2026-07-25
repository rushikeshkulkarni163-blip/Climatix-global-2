"""
Climactix — Risk OS Persistent Assessment Agent
==================================================
A scoped chat agent over ONE assessment's real Firestore data — not a copy
of the separate climactix-ai/ Qdrant/LangGraph product surface, and not a
generic open LLM chat. Every tool the model can call is a direct,
RBAC-scoped Firestore read (or a delegation into the existing, already-
grounded risk_os_ai_review.run_ai_review for drafting), so an answer like
"what evidence am I missing" is backed by real reads against this specific
assessment, never fabricated from general knowledge.

The assessmentId/companyId are fixed by the caller (functions/main.py,
after its own RBAC check) and never taken from the model or the user
message — the model can only ever see the one assessment it was scoped to.
"""

from __future__ import annotations

import json
import os
from typing import Optional

from openai import OpenAI

from services.risk_os_ai_review import run_ai_review

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
MAX_TOOL_ROUNDS = 4

_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set.")
        _client = OpenAI(api_key=api_key)
    return _client


_SYSTEM_PROMPT = """You are the Climactix Assessment Agent — an institutional climate-risk \
analyst assistant embedded in one specific Risk OS assessment. You are NOT a general chatbot.

Hard rules:
- Answer ONLY using the tool outputs you retrieve in this conversation. Never state a fact \
about this assessment (a score, a status, an evidence count, a contradiction) that you have \
not just fetched via a tool call.
- If a tool returns no data, say so plainly ("no evidence has been uploaded against this \
question yet") — never guess or fill the gap with a plausible-sounding invention.
- Always cite the questionId(s) your answer is grounded in.
- Write in the institutional register of a Moody's/MSCI analyst note — concise, no hedging \
filler, no marketing language.
- You may call tools multiple times before answering, but must give a final text answer \
within a few tool calls — do not loop indefinitely."""

_TOOLS = [
    {"type": "function", "function": {
        "name": "get_answer", "description": "Fetch the declared status/justification for one assessment question.",
        "parameters": {"type": "object", "properties": {
            "questionId": {"type": "string", "description": "e.g. S05-Q02"}}, "required": ["questionId"]},
    }},
    {"type": "function", "function": {
        "name": "get_evidence", "description": "List evidence files uploaded against one question.",
        "parameters": {"type": "object", "properties": {
            "questionId": {"type": "string"}}, "required": ["questionId"]},
    }},
    {"type": "function", "function": {
        "name": "search_evidence", "description": "Search all evidence filenames/categories in this assessment by keyword.",
        "parameters": {"type": "object", "properties": {
            "keyword": {"type": "string"}}, "required": ["keyword"]},
    }},
    {"type": "function", "function": {
        "name": "get_contradictions", "description": "List all durable contradiction flags recorded for this assessment (rule/AI-review/graph sourced).",
        "parameters": {"type": "object", "properties": {}}, "required": [],
    }},
    {"type": "function", "function": {
        "name": "get_quality_gate", "description": "Get the assessment's current overall score, rating, and status.",
        "parameters": {"type": "object", "properties": {}}, "required": [],
    }},
    {"type": "function", "function": {
        "name": "draft_response", "description": "Generate an evidence-grounded draft management response for one question, using its most recent uploaded evidence file. Returns a DRAFT for the human to review — never inserts it automatically.",
        "parameters": {"type": "object", "properties": {
            "questionId": {"type": "string"}}, "required": ["questionId"]},
    }},
]


def _tool_get_answer(db, assessment_id: str, question_id: str) -> dict:
    doc = db.collection("ros_answers_v1").document(f"{assessment_id}_{question_id}").get()
    if not doc.exists:
        return {"questionId": question_id, "found": False}
    data = doc.to_dict()
    raw = data.get("rawAnswer")
    status = raw.get("status") if isinstance(raw, dict) else raw
    justification = raw.get("justification") if isinstance(raw, dict) else None
    return {
        "questionId": question_id, "found": True, "status": status,
        "justification": justification,
        "assessedStatus": data.get("assessedStatus"),
        "assessedConfidence": data.get("assessedConfidence"),
    }


def _tool_get_evidence(db, assessment_id: str, question_id: str) -> dict:
    docs = (
        db.collection("ros_evidence_v1")
        .where("assessmentId", "==", assessment_id).where("questionId", "==", question_id)
        .stream()
    )
    items = [{
        "filename": d.to_dict().get("originalName") or d.to_dict().get("filename"),
        "reviewStatus": d.to_dict().get("reviewStatus"),
        "documentCategory": d.to_dict().get("documentCategory"),
    } for d in docs]
    return {"questionId": question_id, "count": len(items), "evidence": items}


def _tool_search_evidence(db, assessment_id: str, keyword: str) -> dict:
    keyword_lower = (keyword or "").lower()
    docs = db.collection("ros_evidence_v1").where("assessmentId", "==", assessment_id).stream()
    matches = []
    for d in docs:
        data = d.to_dict()
        haystack = " ".join(filter(None, [
            data.get("originalName"), data.get("filename"), data.get("documentCategory"),
        ])).lower()
        if keyword_lower in haystack:
            matches.append({
                "evidenceId": d.id, "filename": data.get("originalName") or data.get("filename"),
                "questionId": data.get("questionId"), "documentCategory": data.get("documentCategory"),
            })
    return {"keyword": keyword, "matches": matches[:10]}


def _tool_get_contradictions(db, assessment_id: str) -> dict:
    docs = db.collection("ros_contradiction_flags_v1").where("assessmentId", "==", assessment_id).stream()
    flags = [{
        "ruleId": d.to_dict().get("ruleId"), "severity": d.to_dict().get("severity"),
        "questionIds": d.to_dict().get("questionIds"), "summary": d.to_dict().get("summary"),
        "sourceType": d.to_dict().get("sourceType"),
    } for d in docs]
    return {"count": len(flags), "flags": flags}


def _tool_get_quality_gate(db, assessment_id: str) -> dict:
    doc = db.collection("ros_assessments_v1").document(assessment_id).get()
    if not doc.exists:
        return {"found": False}
    data = doc.to_dict()
    return {
        "found": True, "status": data.get("status"),
        "overallScore": data.get("overallScore"), "rating": data.get("rating"),
        "greenwashingProbability": data.get("greenwashingProbability"),
    }


def _tool_draft_response(db, assessment_id: str, question_id: str) -> dict:
    evidence_snap = (
        db.collection("ros_evidence_v1")
        .where("assessmentId", "==", assessment_id).where("questionId", "==", question_id)
        .limit(1).get()
    )
    if not evidence_snap:
        return {"questionId": question_id, "drafted": False, "reason": "No evidence uploaded against this question yet."}
    from firebase_admin import storage
    ev = evidence_snap[0].to_dict()
    bucket = storage.bucket()
    blob = bucket.blob(ev["storagePath"])
    if not blob.exists():
        return {"questionId": question_id, "drafted": False, "reason": "Stored file no longer available."}
    content = blob.download_as_bytes()
    result = run_ai_review(
        "draft_response", content=content, filename=ev.get("filename", "document"),
        content_type=ev.get("fileType") or "", question_text=question_id,
    )
    return {"questionId": question_id, "drafted": True, "draft": result["output_summary"], "citations": result.get("citations", [])}


_TOOL_IMPLS = {
    "get_answer": _tool_get_answer,
    "get_evidence": _tool_get_evidence,
    "search_evidence": _tool_search_evidence,
    "get_contradictions": _tool_get_contradictions,
    "get_quality_gate": _tool_get_quality_gate,
    "draft_response": _tool_draft_response,
}


def chat(db, assessment_id: str, user_message: str, history: Optional[list] = None) -> dict:
    """
    Runs one user turn through a bounded tool-calling loop.
    Returns { reply: str, toolCalls: [{name, args, result}] }.
    `history` is the prior [{role, content}] turns (assistant/user text only —
    tool-call plumbing is re-derived fresh each turn, not replayed).
    """
    client = _get_client()
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for turn in (history or [])[-10:]:
        messages.append({"role": turn["role"], "content": turn["text"]})
    messages.append({"role": "user", "content": user_message})

    tool_call_log = []

    for _ in range(MAX_TOOL_ROUNDS):
        resp = client.chat.completions.create(
            model=MODEL, max_tokens=800, temperature=0.1,
            messages=messages, tools=_TOOLS, tool_choice="auto",
        )
        choice = resp.choices[0]
        if not choice.message.tool_calls:
            return {"reply": choice.message.content or "", "toolCalls": tool_call_log}

        messages.append({
            "role": "assistant", "content": choice.message.content or "",
            "tool_calls": [tc.model_dump() for tc in choice.message.tool_calls],
        })
        for tc in choice.message.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            impl = _TOOL_IMPLS.get(name)
            result = impl(db, assessment_id, *args.values()) if impl else {"error": f"Unknown tool {name}"}
            tool_call_log.append({"name": name, "args": args, "result": result})
            messages.append({
                "role": "tool", "tool_call_id": tc.id, "content": json.dumps(result, default=str),
            })

    # Ran out of rounds — ask the model for a final answer with no more tools.
    final = client.chat.completions.create(
        model=MODEL, max_tokens=600, temperature=0.1,
        messages=messages + [{"role": "user", "content": "Give your best answer now based on what you've retrieved."}],
    )
    return {"reply": final.choices[0].message.content or "", "toolCalls": tool_call_log}
