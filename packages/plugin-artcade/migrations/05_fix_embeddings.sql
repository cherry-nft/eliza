-- Verify pgvector extension
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'vector'
    ) THEN
        RAISE EXCEPTION 'vector extension is not installed';
    END IF;
END
$$;

-- Create a backup of the current embeddings
CREATE TABLE IF NOT EXISTS vector_patterns_backup_embeddings AS
SELECT id, embedding
FROM vector_patterns
WHERE embedding IS NOT NULL;

-- Function to validate embedding dimensions
CREATE OR REPLACE FUNCTION validate_embedding_dimensions(embedding_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    dimensions INTEGER;
BEGIN
    -- Extract array from JSON-like string and count elements
    WITH parsed AS (
        SELECT array_length(
            string_to_array(
                trim(both '[]' from embedding_text),
                ','
            ),
            1
        ) as dim
    )
    SELECT dim INTO dimensions FROM parsed;

    RETURN dimensions = 1536;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$;

-- Begin the update process
DO $$
DECLARE
    invalid_rows INTEGER := 0;
    updated_rows INTEGER := 0;
    skipped_rows INTEGER := 0;
BEGIN
    -- First pass: Count invalid embeddings
    SELECT COUNT(*)
    INTO invalid_rows
    FROM vector_patterns
    WHERE embedding IS NOT NULL
    AND NOT validate_embedding_dimensions(embedding::text);

    IF invalid_rows > 0 THEN
        RAISE NOTICE 'Found % rows with invalid embedding dimensions', invalid_rows;
    END IF;

    -- Update embeddings that are stored as strings
    WITH updated AS (
        UPDATE vector_patterns
        SET embedding = embedding::text::vector(1536)
        WHERE embedding IS NOT NULL
        AND validate_embedding_dimensions(embedding::text)
        RETURNING id
    )
    SELECT COUNT(*) INTO updated_rows
    FROM updated;

    -- Count skipped rows
    SELECT COUNT(*)
    INTO skipped_rows
    FROM vector_patterns
    WHERE embedding IS NOT NULL
    AND NOT validate_embedding_dimensions(embedding::text);

    -- Log results
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE '  - Updated % rows', updated_rows;
    RAISE NOTICE '  - Skipped % invalid rows', skipped_rows;

    -- If we have invalid rows, raise a warning
    IF skipped_rows > 0 THEN
        RAISE WARNING 'Some rows were skipped due to invalid dimensions. Check vector_patterns_backup_embeddings for original data.';
    END IF;
END;
$$;

-- Verify the results
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO invalid_count
    FROM vector_patterns
    WHERE embedding IS NOT NULL
    AND array_length(embedding::float[], 1) != 1536;

    IF invalid_count > 0 THEN
        RAISE WARNING 'Found % embeddings with incorrect dimensions after migration', invalid_count;
    ELSE
        RAISE NOTICE 'All embeddings have correct dimensions';
    END IF;
END;
$$;

-- Rollback function in case of issues
CREATE OR REPLACE FUNCTION rollback_embedding_migration()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- Restore original embeddings from backup
    UPDATE vector_patterns vp
    SET embedding = backup.embedding
    FROM vector_patterns_backup_embeddings backup
    WHERE vp.id = backup.id;

    RAISE NOTICE 'Embeddings restored from backup';
END;
$$;