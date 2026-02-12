export const NOT_FOUND_PROMPT = `Task: From the input list, identify biomarkers that health app users commonly track. Return ONLY the "id" of each kept biomarker. Return raw JSON only.

Step 1: Scan input to identify absolute/% pairs.

Step 2 - EXCLUDE (always reject these):
- Ratios with "/" or "Ratio" in name (calculated from other tests)
- Derived/calculated values (Average Glucose from HbA1c, eAG)
- Absolute counts if percentage version exists in same input
- Subjective observations (Color, Appearance, Odor)
- Microscopy details (Epithelial Cells, Casts, Crystals, Bacteria, Yeast)
- Obscure urine chemicals (Ketones, Nitrite, Urobilinogen, Bile Salts/Pigments)

Step 3 - EVALUATE each remaining test: Would average health app users track this?

Decision criteria (ALL must be YES):
- Understandability: Can non-medical users understand what this measures?
- Actionability: Can users take action based on results (diet, lifestyle, doctor visit)?
- Popularity: Is this commonly discussed in health/wellness content?
- Tracking value: Do users benefit from monitoring this over time?

RED FLAGS (likely exclude):
- Technical lab indices (MCH, MCHC, RDW, MPV, PDW, MCV)
- Detailed cell breakdowns (Neutrophils%, Lymphocytes%, Monocytes%, Eosinophils%, Basophils%)
- Redundant measurements (PCV when Hemoglobin exists, Urea when BUN exists)
- Specialist-only tests rarely ordered by GPs
- Tests users can't interpret without medical training

GREEN FLAGS (likely include):
- Tests mentioned in health articles/apps (cholesterol, blood sugar, vitamin levels)
- Tests for common conditions (diabetes, heart disease, thyroid, anemia)
- Tests users ask doctors about regularly
- Tests with clear health implications

OUTPUT FORMAT (strict):
Return ONLY a JSON array of objects, each containing just the "id" field from the input.
CRITICAL: The "id" MUST be copied EXACTLY as it appears in the input with NO modifications.
Do NOT generate any other fields. Do NOT include test_name, alias_names, or interpretations.

[{"id": "original-id-from-input"}, {"id": "original-id-from-input"}]

If no biomarkers pass the filter, return: []

Examples (for reasoning only, output is always just IDs):
- "Hemoglobin" → users understand (anemia), actionable (iron intake), popular → KEEP its id
- "Cholesterol" → users track for heart health, very popular → KEEP its id
- "HbA1c" → users with diabetes track this, popular → KEEP its id
- "MCH" → technical term, users don't know what it means → EXCLUDE
- "Neutrophils" → users don't understand cell types → EXCLUDE
- "WBC" total → users understand "immune cells" → KEEP its id
- "PCV" when "Hemoglobin" exists → redundant → EXCLUDE`;
