export const REPORT_PROMPT = `CRITICAL: OUTPUT RAW JSON ONLY
- Return ONLY valid JSON - no markdown, no code blocks, no \`\`\` characters
- Ensure the JSON is COMPLETE with all closing braces and brackets
- Do NOT wrap JSON in \`\`\`json ... \`\`\`
- The response must start with { and end with }

ROLE: Extract ALL tests from lab reports into structured JSON.
Tests array = single source of truth for all analysis.

SECTION A: DOCUMENT CLASSIFICATION (CRITICAL - DO THIS FIRST!)

Carefully examine the document and classify it using these indicators:

**REPORT Indicators:**
- Lab name or diagnostic center header (e.g., Dr. Lal PathLabs, Thyrocare, etc.)
- Sections like "Hematology", "Lipid Profile", "Liver Function Test", "Kidney Function Test".
- Test names with numeric or qualitative results.
- Reference ranges (e.g., 12.0 - 16.0) and units (e.g., mg/dL, g/dL).
- Status markers like (H), (L), *, HIGH, LOW, ABNORMAL.

**INVALID Indicators:**
- Blurry/unreadable text.
- Non-medical content (receipts, bills, general letters).
- **PRESCRIPTION Indicators** (This is a lab prompt, NOT a prescription prompt):
    - "Rx" symbol or "R/" notation.
    - Dosage frequencies (1-0-1, BD, TDS).
    - Drug names only without test results.
    - If it's a prescription, it's INVALID for this prompt.

⛔ INVALID HANDLING: If document_type is "INVALID", immediately stop extraction, set error_response.is_error to true, provide the technical_reason, and return valid JSON with an empty tests array [].

🎯 CORE PRINCIPLE: TESTS ARRAY FIRST


SECTION B: WORKFLOW & EXTRACTION RULES


### 1. WORKFLOW:
1. Classify document (Section A).
2. Extract ALL tests → Build "tests" array (PRIMARY - 100% effort).

NEVER count abnormalities manually!
ALWAYS derive from tests array after extraction.


📋 EXTRACTION RULES (Complete = No Exceptions)


Extract EVERY test including:
✓ Normal AND abnormal values
✓ Each "NOT DETECTED"/"NEGATIVE" as separate test
✓ Both percentage AND absolute counts (e.g., Neutrophils %, Abs. Neutrophils)
✓ All calculated ratios (TC:HDL, BUN:Creatinine, Apo B:A)
✓ All component types (Total/Direct/Indirect Bilirubin = 3 tests)
✓ Multiple calculation methods (GFR CkD-EPI, GFR MDRD = 2 tests)

Do NOT duplicate:
✗ Same test appearing in multiple places = extract once only
Example: ALP in both Liver & Arthritis sections = 1 test (not 2)


📄 MULTI-PAGE REPORT PROCESSING


For reports with multiple pages:

STEP-BY-STEP PROCESS:
1. Process EVERY page sequentially (Page 1 → Page 2 → ... → Page N)
2. Extract tests from ALL sections:
   - Header/summary pages
   - Individual test result pages
   - Reference/legend pages (if they contain test values)
   - Negative findings sections
   - Appendix/notes (if they contain additional test results)

3. Pay special attention to LAST pages - often contain "Not Detected" lists
4. Keep running tally as you go (see next section)

COMMON MISTAKE: Skipping the last page that lists "Tests Not Detected"
→ SOLUTION: Always check final pages for negative findings sections


📊 PAGE-BY-PAGE COUNTING & VERIFICATION (MANDATORY)
COUNT as you extract - keep running tally:

PROCESS:
1. Process Page 1 → Count tests → Note: "Page 1: X tests"
2. Process Page 2 → Count tests → Note: "Page 2: Y tests"
3. Continue for all pages...
4. Calculate: Total = Sum of all page counts
5. Verify: tests.length = Total

TRACKING EXAMPLE:
Page 1 (Vitamin Profile): 2 tests      | Running total: 2
Page 2 (Vitamin Profile): 0 tests      | Running total: 2
Page 3 (Lipid Profile): 4 tests        | Running total: 6
Page 4 (Lipid Profile): 4 tests        | Running total: 10
Page 5 (Lipid Profile): 2 tests        | Running total: 12
Page 6 (Liver Profile): 5 tests        | Running total: 17
Page 7 (Liver Profile): 3 tests        | Running total: 20
Page 8 (Liver Profile): 4 tests        | Running total: 24
Page 9 (Kidney Profile): 4 tests       | Running total: 28
Page 10 (Kidney Profile): 4 tests      | Running total: 32
Page 11 (Thyroid): 1 test              | Running total: 33
Page 12 (Diabetes): 3 tests            | Running total: 36
Page 13 (Arthritis): 3 tests           | Running total: 39
Page 14 (Anemia): 3 tests              | Running total: 42
Page 15 (Anemia): 6 tests              | Running total: 48
Page 16 (Blood Counts): 7 tests        | Running total: 55
Page 17 (Blood Counts): 5 tests        | Running total: 60
Page 18 (Blood Counts): 4 tests        | Running total: 64
Page 19 (Urinalysis): 4 tests          | Running total: 68
Page 20 (Urinalysis): 17 tests         | Running total: 85

TOTAL: 85 tests
tests.length = 85
MATCH: YES ✓

VERIFICATION CHECK:
□ Sum of page counts = 85
□ tests.length = 85
□ Match: YES → Proceed
□ If mismatch > 2: STOP and re-scan missed pages

COMMON MISTAKES TO AVOID:
❌ Skipping "info only" pages (still count 0)
❌ Missing last page with negative findings
❌ Not tracking running total
❌ Forgetting to count each "NOT DETECTED" separately
❌ Estimating instead of exact counting

CRITICAL RULE:
Keep running tally in your internal process.
Final tests.length MUST equal sum of page counts (±2 tolerance).

SECTION F: OUTPUT SCHEMA


{
  "document_type": "LAB REPORT | INVALID",
  "error_response": {
    "is_error": false,
    "technical_reason": "String or null (e.g., 'Document is a prescription, not a lab report')"
  },
  "patient_info": {
    "name": "string | null (remove salutations)",
    "age": "string | null",
    "gender": "string | null",
    "age_gender": "original age_gender string | null (legacy support)"
  },
  "report_meta": {
    "lab_name": "string | null",
    "test_type": "string | null (2-3 word text that gives some light on what kind of report it is like Lipid Profile, etc)",
    "collection_date": "YYYY-MM-DD | null",
    "report_date": "YYYY-MM-DD | null"
  },
  "common_data": {
    "ai_summary": "String (40-70 words. A simple, non-technical summary of the entire report for someone with NO medical background.)"
  },
  "tests": [
    {
      "name": "string (exact test name from report)",
      "value": "number | string | 'NOT DETECTED' | 'NEGATIVE'",
      "unit": "string | null",
      "ref_min": "number | null",
      "ref_max": "number | null",
      "ref_type": "between | min | max | exact | text",
      "status": "NORMAL | LOW | HIGH | BORDERLINE | CRITICAL | ABNORMAL"
    }
  ],
  "quality": {
    "tests_extracted": "number (MUST equal tests.length exactly)",
    "confidence": 0.0-1.0,
    "review_needed": "boolean"
  }
}


📏 REFERENCE RANGE PARSING (CRITICAL FOR ACCURACY)


Parse reference ranges into structured format:

FORMAT: "X - Y" | "X to Y" | "X-Y"
→ ref_type: "between", ref_min: X, ref_max: Y
Example: "12-16 g/dL" → ref_min: 12.0, ref_max: 16.0, ref_type: "between"

FORMAT: "< X" | "≤ X" | "Desirable < X" | "Up to X"
→ ref_type: "max", ref_min: null, ref_max: X
Example: "< 200 mg/dL" → ref_min: null, ref_max: 200.0, ref_type: "max"

FORMAT: "> X" | "≥ X" | "Protective > X" | "At least X"
→ ref_type: "min", ref_min: X, ref_max: null
Example: "> 40 mg/dL" → ref_min: 40.0, ref_max: null, ref_type: "min"

FORMAT: "NEGATIVE" | "NON-REACTIVE" | "ABSENT"
→ ref_type: "exact", ref_min: null, ref_max: null

FORMAT: "Normal" | "Satisfactory" | "Clear"
→ ref_type: "text", ref_min: null, ref_max: null

⚠️ CRITICAL RULE: Extract the NORMAL range, NOT the abnormal range

EXAMPLE - Common Error:
Report shows: "TOO LOW < 20 | LOW 20-30 | NORMAL 30-100 | HIGH > 100"
For Vitamin D value = 14.3:

❌ WRONG: ref_min: 20.0, ref_max: 30.0 (this is the LOW range)
✅ CORRECT: ref_min: 30.0, ref_max: 100.0 (this is the NORMAL range)

Always extract boundaries of NORMAL range, not the range where value falls.


🎯 STATUS ASSIGNMENT LOGIC


STEP 1: Check for explicit markers in report
If report shows: ↑ | H | *HIGH* | "HIGH" → status: "HIGH"
If report shows: ↓ | L | *LOW* | "LOW" → status: "LOW"
If report shows: !! | *CRITICAL* → status: "CRITICAL"
If report shows: *BORDERLINE* → status: "BORDERLINE"

STEP 2: Calculate from reference range (if no explicit marker)

FOR ref_type = "between":
  if value < ref_min → "LOW"
  if value > ref_max → "HIGH"
  if value = ref_min OR value = ref_max → "BORDERLINE"
  if ref_min < value < ref_max → "NORMAL"

FOR ref_type = "max":
  if value > ref_max → "HIGH"
  if value = ref_max → "BORDERLINE"
  if value < ref_max → "NORMAL"

FOR ref_type = "min":
  if value < ref_min → "LOW"
  if value = ref_min → "BORDERLINE"
  if value > ref_min → "NORMAL"

FOR ref_type = "exact":
  if value = "NOT DETECTED" or "NEGATIVE" (when that's normal) → "NORMAL"
  if value = "DETECTED" or "POSITIVE" (when that's abnormal) → "ABNORMAL"

FOR ref_type = "text":
  if descriptive value seems normal → "NORMAL"
  if descriptive value is clinically abnormal → "ABNORMAL"
  if descriptive value suggests borderline/equivocal → "BORDERLINE"

⛔ STRICT RULE: The "status" field MUST be one of EXACTLY these 6 values:
NORMAL | LOW | HIGH | BORDERLINE | CRITICAL | ABNORMAL
Do NOT use any other value. Do NOT invent new statuses like "DETECTED", "ELEVATED", "POSITIVE", etc.
If unsure, default to: null

EXAMPLE - HDL Status Assignment:
Report shows: "HDL: 53.9 mg/dL" 
Ranges shown: "LOW < 35 | BORDERLINE 35-55 | NORMAL > 55"

Value = 53.9 falls in BORDERLINE range (35-55)
→ status: "BORDERLINE" ✓

NOT "NORMAL" just because it's close to 55.


📅 DATE & UNIT HANDLING


DATE FORMATS - Auto-detect input, ALWAYS output as YYYY-MM-DD:
  Input: "18-08-2019" → Output: "2019-08-18"
  Input: "05-Feb-2026" → Output: "2026-02-05"
  Input: "2026/02/05" → Output: "2026-02-05"
  Input: "05.02.2026" → Output: "2026-02-05"
  Input: "February 5, 2026" → Output: "2026-02-05"

UNIT EXTRACTION:
  Extract units EXACTLY as printed in report
  DO NOT convert units (keep mg/dL, don't convert to mmol/L)
  Keep IU/L, g/dL, cells/µL, ng/mL, pg/mL, etc. as shown
  If no unit visible, set unit: null






SECTION I: AI SUMMARY GENERATION


Generate a summary of the entire lab report based on these rules:
- Length: EXACTLY 40-70 words.
- Tone: Extremely simple, empathetic, and easy to understand for a common person.
- Content: Cover the overall technical essence of the report, explaining any major findings or "good news" in plain English.
- Audience: Someone with NO medical background.
- Language: Plain English only.


✅ PRE-OUTPUT VALIDATION (MANDATORY - ALL CHECKS)


Complete ALL validation steps before generating output:

STEP 1: Page-by-Page Count Verification
□ Counted tests on each page with running tally
□ Sum of all pages = ___ (manual total)
□ tests.length = ___ (actual JSON array length)
□ Match within ±2 tolerance? 
  → If NO: Re-scan pages and identify which page(s) were missed

STEP 2: Negative Findings Check
□ Checked all pages (especially last pages) for "Not Detected" sections?
□ Each "NOT DETECTED" item extracted as separate test?
□ If missed any: Add them now

STEP 3: Duplicate Check
□ No test appears twice with same value?
□ Remove duplicates if found

STEP 4: Quality Fields Accuracy
□ quality.tests_extracted = tests.length (exact match, not estimate)
□ confidence calculated appropriately (0.0-1.0)
□ review_needed set correctly based on validation results

STEP 5: Final Sanity Checks
□ tests.length matches sum of page counts (±2 tolerance)
□ JSON syntax valid (no trailing commas, proper escaping)
□ All required fields present


DECISION GATE:
IF ALL CHECKS PASS → Proceed to generate final JSON output
IF ANY CHECK FAILS → Fix the issue, then re-run validation


\`\`\`markdown
🚨 CRITICAL ERRORS TO AVOID

❌ Wrong reference ranges (extracting LOW/HIGH range instead of NORMAL)
✅ Always extract NORMAL range boundaries (e.g., 30-100, not 20-30)

❌ Duplicate test entries (same test, same value)
✅ Extract once

❌ Skipping negative findings ("NOT DETECTED")
✅ Each "NOT DETECTED" item = separate test entry in the array

❌ Wrong status for boundary values
✅ Value exactly at boundary (e.g., value = ref_max) = "BORDERLINE"

❌ Discrepancy between manual page tally and tests.length
✅ quality.tests_extracted MUST match tests.length exactly
\`\`\`


📝 COMPLETE EXAMPLE WITH VERIFICATION


INPUT REPORT (3 pages):
┌────────────────────────────────────────────────────┐
│ Page 1: Patient Info + CBC                         │
│ Hemoglobin: 11.2 g/dL [12-16] *LOW*                │
│ WBC: 8200 /µL [4000-11000]                          │
│ Platelets: 245000 /µL [150000-400000]              │
│                                                     │
│ Page 2: Lipid Profile                               │
│ Total Cholesterol: 245 mg/dL [<200] *HIGH*         │
│ HDL: 48 mg/dL [BORDERLINE: 35-55, NORMAL: >55]     │
│ Triglycerides: 185 mg/dL [<150] *HIGH*             │
│                                                     │
│ Page 3: Urinalysis                                  │
│ Color: Pale Yellow [Normal]                         │
│ pH: 6.0 [5.0-7.0]                                   │
│ Protein: NEGATIVE                                   │
│ Not Detected: Glucose, Ketones, Blood              │
└────────────────────────────────────────────────────┘

STEP 1: Page-by-Page Extraction & Counting

Page 1: 3 tests (Hemoglobin, WBC, Platelets)         | Running: 3
Page 2: 3 tests (Total Chol, HDL, Triglycerides)     | Running: 6
Page 3: 6 tests (Color, pH, Protein, Glucose, 
                 Ketones, Blood)                      | Running: 12

TOTAL PAGE COUNT: 12 tests

STEP 2: Build Tests Array

[... extract all 12 tests into array ...]
tests.length = 12 ✓ (matches page count)

OUTPUT JSON:
{
  "document_type": "LAB REPORT",
  "patient_info": {
    "name": null,
    "age_gender": null
  },
  "report_meta": {
    "lab_name": null,
    "test_type": "Lipid Profile",
    "collection_date": null,
    "report_date": null
  },
  "common_data": {
    "ai_summary": "This is a simple analysis of your blood test results. Your hemoglobin levels are slightly low, which could mean you have a mild case of anemia. Most other counts are in the normal range, and your kidney function looks healthy. You should discuss these findings with your doctor for a complete check-up."
  },
  "tests": [
    {
      "name": "Hemoglobin",
      "value": 11.2,
      "unit": "g/dL",
      "ref_min": 12.0,
      "ref_max": 16.0,
      "ref_type": "between",
      "status": "LOW"
    },
    {
      "name": "Total Cholesterol",
      "value": 245,
      "unit": "mg/dL",
      "ref_min": null,
      "ref_max": 200.0,
      "ref_type": "max",
      "status": "HIGH"
    },
    {
      "name": "Urine Color",
      "value": "Pale Yellow",
      "unit": null,
      "ref_min": null,
      "ref_max": null,
      "ref_type": "text",
      "status": "NORMAL"
    },
    {
      "name": "Protein (Urine)",
      "value": "NOT DETECTED",
      "unit": null,
      "ref_min": null,
      "ref_max": null,
      "ref_type": "exact",
      "status": "NORMAL"
    },
  ],
  "quality": {
    "tests_extracted": 12,
    "confidence": 0.98,
    "review_needed": false
  }
}

FINAL VERIFICATION:

✓ Page count sum: 12
✓ tests.length: 12
✓ Match: YES
✓ quality.tests_extracted = 12 = tests.length: YES
✓ All validations passed: READY TO OUTPUT


🎯 COMPLETE WORKFLOW SUMMARY (Follow This Order)


PHASE 1: EXTRACTION (100% Effort)
┌────────────────────────────────────────────────┐
│ 1. Process report page by page                 │
│ 2. For each page: Count tests as you extract   │
│ 3. Keep running tally: "Page X: Y | Total: Z"  │
│ 4. Build tests array with ALL extracted tests  │
│ 5. Sum all page counts = expected total        │
└────────────────────────────────────────────────┘

PHASE 2: VERIFICATION
┌────────────────────────────────────────────────┐
│ 6. Verify: tests.length = sum of page counts   │
│ 7. If mismatch > 2: Identify & re-scan missing │
│ 8. Verify: No duplicate entries                │
│ 9. Verify: All "NOT DETECTED" extracted        │
└────────────────────────────────────────────────┘

PHASE 3: FINAL VALIDATION
┌────────────────────────────────────────────────┐
│ 10. Re-verify: tests.length = page sum         │
│ 11. Set quality.tests_extracted = tests.length │
│ 12. Validate JSON syntax                       │
└────────────────────────────────────────────────┘

PHASE 4: OUTPUT
┌────────────────────────────────────────────────┐
│ 13. Generate final JSON output                 │
└────────────────────────────────────────────────┘


🎯 KEY REMINDERS


1. Tests array = single source of truth
2. Count page by page with running tally
3. Extract NORMAL reference ranges (not abnormal ranges)
4. Each "NOT DETECTED" = separate test
5. Same test in multiple places = extract once only
6. Verify: tests.length = sum of page counts
7. Output JSON only (no explanations)
`;
