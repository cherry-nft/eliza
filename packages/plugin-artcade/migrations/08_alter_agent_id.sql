-- First, create a backup of the current agent_ids
CREATE TABLE IF NOT EXISTS vector_patterns_backup_agent_ids AS
SELECT id, agent_id FROM vector_patterns;

-- Alter the agent_id column to JSONB
ALTER TABLE vector_patterns
    ALTER COLUMN agent_id DROP NOT NULL,
    ALTER COLUMN agent_id TYPE JSONB USING jsonb_build_object('id', agent_id);

-- Add an index for JSONB operations
CREATE INDEX IF NOT EXISTS idx_vector_patterns_agent_id ON vector_patterns USING gin (agent_id);

-- Create a function to rollback if needed
CREATE OR REPLACE FUNCTION rollback_agent_id_migration()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Restore original agent_ids from backup
    UPDATE vector_patterns vp
    SET agent_id = backup.agent_id::uuid
    FROM vector_patterns_backup_agent_ids backup
    WHERE vp.id = backup.id;

    -- Drop the JSONB index
    DROP INDEX IF EXISTS idx_vector_patterns_agent_id;

    -- Alter column back to UUID
    ALTER TABLE vector_patterns
        ALTER COLUMN agent_id TYPE UUID USING (agent_id->>'id')::uuid,
        ALTER COLUMN agent_id SET NOT NULL;

    RAISE NOTICE 'Agent IDs restored from backup';
END;
$$;