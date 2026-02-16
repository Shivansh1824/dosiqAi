-- Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  gender TEXT,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);

-- Enable RLS
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own family members"
  ON family_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own family members"
  ON family_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own family members"
  ON family_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own family members"
  ON family_members FOR DELETE
  USING (auth.uid() = user_id);

-- Update documents table for local storage
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS local_file_path TEXT,
  ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ADD COLUMN IF NOT EXISTS is_local BOOLEAN DEFAULT true;

-- Make file_url nullable (for backward compatibility)
ALTER TABLE documents ALTER COLUMN file_url DROP NOT NULL;

-- Index for family member documents
CREATE INDEX IF NOT EXISTS idx_documents_family_member ON documents(family_member_id);
