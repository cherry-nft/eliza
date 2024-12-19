-- Drop existing function first
DROP FUNCTION IF EXISTS convert_single_embedding(UUID);

-- Function to update a single record
CREATE OR REPLACE FUNCTION convert_single_embedding(input_id UUID)
RETURNS TABLE (
    id UUID,
    old_type TEXT,
    new_type TEXT,
    dimensions INTEGER,
    status TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    old_embedding TEXT;
    new_vector vector;
    vec_dim INTEGER;
BEGIN
    -- Get current embedding
    SELECT embedding::text INTO old_embedding
    FROM vector_patterns
    WHERE vector_patterns.id = input_id;

    IF old_embedding IS NULL THEN
        RETURN QUERY
        SELECT
            input_id,
            'unknown'::TEXT,
            'unknown'::TEXT,
            0,
            'ERROR: No embedding found'::TEXT;
        RETURN;
    END IF;

    -- Try conversion
    BEGIN
        -- Convert and store in one step
        WITH conversion AS (
            SELECT convert_embedding_to_vector(old_embedding) as new_vec
        )
        UPDATE vector_patterns
        SET embedding = (SELECT new_vec FROM conversion)
        WHERE vector_patterns.id = input_id
        RETURNING vector_dims(embedding) INTO vec_dim;

        -- Return success result
        RETURN QUERY
        SELECT
            input_id,
            'text'::TEXT,
            'vector'::TEXT,
            COALESCE(vec_dim, 0),
            'SUCCESS'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        -- Return error result
        RETURN QUERY
        SELECT
            input_id,
            'text'::TEXT,
            'failed'::TEXT,
            0,
            'ERROR: ' || SQLERRM;
    END;
END;
$$;