#!/bin/bash

# Deployment script for new edge functions
# This script deploys the analyze-prescription and analyze-report edge functions to Supabase

set -e

echo "🚀 Deploying Edge Functions to Supabase"
echo "========================================"
echo ""

# Navigate to mobile directory
cd "$(dirname "$0")/.."

# Deploy analyze-prescription
echo "📦 Deploying analyze-prescription..."
npx supabase functions deploy analyze-prescription
echo "✅ analyze-prescription deployed successfully"
echo ""

# Deploy analyze-report
echo "📦 Deploying analyze-report..."
npx supabase functions deploy analyze-report
echo "✅ analyze-report deployed successfully"
echo ""

echo "🎉 All edge functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify in Supabase Dashboard: Edge Functions → Functions"
echo "2. Test prescription upload flow"
echo "3. Test report upload flow"
echo "4. Check edge function logs for correct routing"
