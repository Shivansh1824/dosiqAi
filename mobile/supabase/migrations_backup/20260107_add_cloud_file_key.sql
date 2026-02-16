-- Add cloud_file_key column to documents table
-- This stores the R2 storage key (path) for cloud-stored files

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS cloud_file_key TEXT;

-- Add index for faster lookups by cloud key
CREATE INDEX IF NOT EXISTS idx_documents_cloud_file_key 
ON documents(cloud_file_key) 
WHERE cloud_file_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN documents.cloud_file_key IS 'R2 storage key (path) for cloud-stored files. NULL if file is only stored locally.';
