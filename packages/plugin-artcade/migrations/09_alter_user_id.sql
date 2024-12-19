-- First, create a backup of the current user_ids
CREATE TABLE IF NOT EXISTS vector_patterns_backup_user_ids AS
SELECT id, user_id FROM vector_patterns;

-- Alter the user_id column to TEXT
ALTER TABLE vector_patterns
    ALTER COLUMN user_id DROP NOT NULL,
    ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- Create an index for text search
CREATE INDEX IF NOT EXISTS idx_vector_patterns_user_id ON vector_patterns(user_id);

-- Create a function to rollback if needed
CREATE OR REPLACE FUNCTION rollback_user_id_migration()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Restore original user_ids from backup
    UPDATE vector_patterns vp
    SET user_id = backup.user_id::uuid
    FROM vector_patterns_backup_user_ids backup
    WHERE vp.id = backup.id;

    -- Drop the text index
    DROP INDEX IF EXISTS idx_vector_patterns_user_id;

    -- Alter column back to UUID
    ALTER TABLE vector_patterns
        ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
        ALTER COLUMN user_id SET NOT NULL;

    RAISE NOTICE 'User IDs restored from backup';
END;
$$;