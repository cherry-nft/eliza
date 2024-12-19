-- First, create the backup table if it doesn't exist
CREATE TABLE IF NOT EXISTS vector_patterns_backup_embeddings (
    id UUID PRIMARY KEY,
    embedding TEXT,  -- Store as TEXT to preserve exact string format
    backed_up_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create the backup function
CREATE OR REPLACE FUNCTION create_vector_backup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clear any existing backup data
    TRUNCATE TABLE vector_patterns_backup_embeddings;

    -- Insert current embeddings
    INSERT INTO vector_patterns_backup_embeddings (id, embedding)
    SELECT id, embedding::text
    FROM vector_patterns
    WHERE embedding IS NOT NULL;

    -- Log the operation
    RAISE NOTICE 'Backup completed: % records', (SELECT COUNT(*) FROM vector_patterns_backup_embeddings);
END;
$$;