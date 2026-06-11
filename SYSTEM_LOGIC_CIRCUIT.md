# 🧠 Council of Intelligence: The Logic Circuit

This document outlines the exact "Flow of Thought" from the moment a user submits a query to the final Verdict.

## ⚡ Circuit Summary
*   **Total API Calls per Query:** 12
*   **Time to Verdict:** ~15-30 seconds (Parallelized)
*   **Cost Efficiency:** Optimized (High-IQ models are reserved for specific steps).

---

## 1. The Gatekeeper (Input & Routing)
**Input:** User Prompt + Optional Image.

### Step 1: The Classifier
*   **Model:** `llama-3.1-8b-instant` (Fast & Cheap)
*   **Task:** Classify prompt into one of 5 categories: `MATH`, `CODING`, `CREATIVE`, `AUDIT`, `GENERAL`.
*   **Why:** Determines which "Specialist Model" will lead the final verdict later.
*   **Calls:** 1

---

## 2. Round 1: The Council (Parallel Execution)
All 5 agents run simultaneously to generate diverse perspectives.

| ID | Role | Primary Model | Backup Model | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Strategist** | `moonshotai/kimi-k2-instruct` | `qwen/qwen3-32b` | Deep reasoning & context. |
| **2** | **Technical** | `llama-4-maverick-17b` | `qwen/qwen3-32b` | **OCR & Vision**. Reading numbers/code. |
| **3** | **Concise** | `llama-3.1-8b-instant` | `gpt-oss-20b` | Fast, "Bottom Line Up Front" summary. |
| **4** | **Creative** | `llama-4-scout-17b` | `gpt-oss-120b` | Novel ideas, out-of-the-box thinking. |
| **5** | **Critical** | `qwen/qwen3-32b` | `kimi-k2-instruct` | Risk assessment & logic auditing. |

*   **Calls:** 5

---

## 3. Round 2: The Peer Review (Judgement)
Each agent reviews the *other* 4 reports to rank them.

*   **Model:** `llama-3.1-8b-instant` (**NEW FIX**)
    *   *Previous:* `llama-3.3-70b-versatile` (Was causing rate limits).
*   **Task:** Output a strict JSON ranking `[1, 3, 2, 5, 4]` based on correctness.
*   **Calls:** 5
*   **Result:** A "Mathematical Winner" is calculated based on these votes.

---

## 4. The Chairman Selection (Dynamic Leadership)
Who writes the final Verdict? The system decides based on the **Category** (Step 1) and **Vision Triggers**.

| Scenario | Chairman Model | Logic |
| :--- | :--- | :--- |
| **Math / Coding** | `qwen/qwen3-32b` | Best at logic/coding benchmarks. |
| **Creative** | `llama-4-maverick` | Best at prose/storytelling. |
| **Vision Override** | `qwen/qwen3-32b` | Triggered if Agent 2 sees `[MATH DETECTED]`. |
| **General/Audit** | `llama-3.3-70b` | Information dense & versatile (The "Genius"). |

---

## 5. The Final Verdict (Synthesis)
The Chairman reads the **Top 3 Specific Reports** (Winners) + Agent 2 (Vision) + Agent 4 (Creative) to synthesize the answer.

*   **Model:** Selected Chairman (see above).
*   **Backup:** `llama-3.1-8b-instant`
*   **Safety Net:** **Strict 15s Timeout**.
    *   If the Chairman hangs, `llama-8b` takes over instantly.
    *   If *that* fails, a Static Error Message is returned.
*   **Calls:** 1

---

## 📊 Token Usage Profile (Per Query)
*   **Llama-3.1-8b (Small):** ~7 Calls (Router + 5 Judges + Backup Verdict).
*   **Mid-Size Models (17B-32B):** ~4 Calls (Agents 1, 2, 4, 5).
*   **Llama-3.3-70b (Large):** **0 or 1 Call** (Verdict only).
    *   *Old System:* Used 70B for all 5 Judges (6 calls total), which caused the "Attempting x5" logs and rate limits.
