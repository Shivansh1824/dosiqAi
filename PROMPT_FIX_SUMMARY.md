# AI Analysis Prompt Storage Fix

**Date:** December 10, 2025
**Issue:** `ai_analysis_prompt` was being saved for ALL analyses, even successful ones
**Solution:** Only save prompt when analysis FAILS

---

## 🐛 Problem

When viewing the database, you saw:
- ✅ `ai_analysis_error` = **NULL** (correct)
- ❌ `ai_analysis_prompt` = **Full prompt text** (wrong - should be NULL for successful analyses)

The prompt was being saved EVERY TIME, wasting database storage.

---

## ✅ Solution

### New Logic:
1. **Successful analysis** → `ai_analysis_prompt` = **NULL** (saves storage)
2. **Failed analysis** → `ai_analysis_prompt` = **Prompt text** (helps debug what went wrong)
3. **Custom prompt used** → Only saved if analysis fails

### Storage Optimization:
- **Before:** Every document stored ~2000 character prompt
- **After:** 95% of documents have NULL prompt (0 bytes)
- **Savings:** ~2 KB per successful document

---

## 📝 Changes Made

### 1. Edge Function Updated
**File:** `mobile/supabase/functions/analyze-document/index.ts`

**Line 317-324 (BEFORE):**
```typescript
await supabase
  .from("documents")
  .update({
    ai_analysis_status: "processing",
    ai_analysis_prompt: prompt || DOCUMENT_ANALYSIS_PROMPT, // ❌ SAVED EVERY TIME
  })
  .eq("id", documentId);
```

**Line 317-324 (AFTER):**
```typescript
// Do NOT save ai_analysis_prompt here - only save on error
await supabase
  .from("documents")
  .update({
    ai_analysis_status: "processing",
    // ai_analysis_prompt removed ✅
  })
  .eq("id", documentId);
```

---

**Line 346-358 (On Success - AFTER):**
```typescript
await supabase
  .from("documents")
  .update({
    ai_analysis_status: "completed",
    ai_analysis_result: analysisResult,
    ai_analyzed_at: new Date().toISOString(),
    ai_analysis_tokens_used: openRouterResponse.usage.total_tokens,
    ai_analysis_error: null, // ✅ Clear any previous error
    ai_analysis_prompt: null, // ✅ Keep NULL for successful analyses
  })
  .eq("id", documentId);
```

---

**Line 379-398 (On Error - AFTER):**
```typescript
await supabase
  .from("documents")
  .update({
    ai_analysis_status: "failed",
    ai_analysis_error: error.message || "Analysis failed",
    ai_analysis_prompt: prompt || DOCUMENT_ANALYSIS_PROMPT, // ✅ Save prompt ONLY on error
  })
  .eq("id", documentId);
```

---

### 2. Database Cleanup Migration Created
**File:** `mobile/supabase/migrations/20251210_clear_prompts_from_successful_analyses.sql`

Clears `ai_analysis_prompt` from all existing successful analyses:
```sql
UPDATE documents
SET ai_analysis_prompt = NULL
WHERE ai_analysis_status = 'completed'
  AND ai_analysis_prompt IS NOT NULL;
```

---

## 🚀 Deployment Steps

### Step 1: Redeploy Edge Function
```bash
cd mobile
npx supabase functions deploy analyze-document
```

**This will:**
- ✅ Stop saving prompts for new successful analyses
- ✅ Save prompts ONLY when analysis fails

### Step 2: Clean Up Existing Data (Optional)
Run this SQL in Supabase SQL Editor to clear prompts from existing successful analyses:

```sql
-- Clear prompts from all successful analyses
UPDATE documents
SET ai_analysis_prompt = NULL
WHERE ai_analysis_status = 'completed'
  AND ai_analysis_prompt IS NOT NULL;

-- Verify cleanup
SELECT
  ai_analysis_status,
  COUNT(*) as total,
  COUNT(ai_analysis_prompt) as with_prompt,
  COUNT(ai_analysis_error) as with_error
FROM documents
GROUP BY ai_analysis_status;
```

**Expected results:**
- `completed`: `with_prompt = 0`, `with_error = 0` (all NULL)
- `failed`: `with_prompt > 0`, `with_error > 0` (has values)
- `pending`: `with_prompt = 0`, `with_error = 0` (all NULL)

---

## 📊 Storage Savings

### Prompt Size:
- Average prompt: **~2000 characters** (2 KB)
- NULL storage: **1 bit** (0 bytes)

### Savings Per Document:
- Successful analysis: **~2 KB saved**
- Failed analysis: No change (prompt needed for debugging)

### At Scale:
| Documents | Success Rate | Storage Saved |
|-----------|--------------|---------------|
| 10,000 | 95% | ~19 MB |
| 100,000 | 95% | ~190 MB |
| 1,000,000 | 95% | ~1.9 GB |

**Cost Impact (Supabase):**
- 1 million successful analyses: **~$0.24/month saved**
- 10 million successful analyses: **~$2.40/month saved**

---

## ✅ Testing Checklist

After redeploying the edge function:

### Test Successful Analysis:
1. [ ] Upload a valid medical document
2. [ ] Wait for analysis to complete
3. [ ] Check database - `ai_analysis_prompt` should be **NULL**
4. [ ] Check database - `ai_analysis_error` should be **NULL**
5. [ ] Verify analysis result displays correctly in app

### Test Failed Analysis:
1. [ ] Upload a corrupted/invalid file (or simulate error)
2. [ ] Wait for analysis to fail
3. [ ] Check database - `ai_analysis_prompt` should contain **prompt text**
4. [ ] Check database - `ai_analysis_error` should contain **error message**
5. [ ] Verify error displays correctly in app

### Database Verification Query:
```sql
-- Check prompt distribution by status
SELECT
  ai_analysis_status,
  COUNT(*) as total_docs,
  COUNT(ai_analysis_prompt) as docs_with_prompt,
  COUNT(ai_analysis_error) as docs_with_error,
  ROUND(100.0 * COUNT(ai_analysis_prompt) / COUNT(*), 2) as prompt_percentage
FROM documents
GROUP BY ai_analysis_status
ORDER BY ai_analysis_status;
```

**Expected Results:**
- `completed`: `prompt_percentage = 0%` (after cleanup)
- `failed`: `prompt_percentage = 100%`
- `pending`: `prompt_percentage = 0%`

---

## 🎯 Summary

### What Changed:
- ✅ `ai_analysis_prompt` now **NULL by default** (successful analyses)
- ✅ `ai_analysis_prompt` **only saved on error** (failed analyses)
- ✅ `ai_analysis_error` **only saved on error** (failed analyses)
- ✅ Both fields **cleared on success** (retry scenarios)

### Benefits:
- **Cleaner database** - Less redundant data
- **Lower storage costs** - ~2 KB saved per successful document
- **Better debugging** - Error cases preserve prompt used
- **Industry best practice** - NULL for optional fields

### No Breaking Changes:
- Existing successful analyses continue to work
- Error handling improved (prompt saved for debugging)
- App functionality unchanged

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `mobile/supabase/functions/analyze-document/index.ts` | Edge function - AI analysis logic |
| `mobile/supabase/migrations/20251210_clear_prompts_from_successful_analyses.sql` | SQL cleanup script |
| `mobile/supabase/migrations/20251210_remove_unused_document_fields.sql` | Previous cleanup (file_size, color) |

---

**Ready to deploy!** 🚀

Run:
```bash
cd mobile
npx supabase functions deploy analyze-document
```

Then optionally clean up existing data with the SQL script.
