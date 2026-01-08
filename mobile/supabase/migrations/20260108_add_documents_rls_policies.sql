-- Add RLS policies for documents table
-- This ensures authenticated users can manage their own documents

-- Enable RLS if not already enabled
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

-- SELECT policy: Users can view their own documents
CREATE POLICY "Users can view own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT policy: Users can insert documents for themselves
CREATE POLICY "Users can insert own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy: Users can update their own documents
-- IMPORTANT: Both USING and WITH CHECK are required for UPDATE to work properly
CREATE POLICY "Users can update own documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON public.documents
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.documents IS 'Stores user documents with RLS enabled. Users can only access their own documents.';
