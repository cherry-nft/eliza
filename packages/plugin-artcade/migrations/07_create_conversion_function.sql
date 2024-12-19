-- Function to validate and convert embeddings
CREATE OR REPLACE FUNCTION convert_embedding_to_vector(embedding_input TEXT)
RETURNS vector
LANGUAGE plpgsql
AS $$
DECLARE
    parsed_array float[];
    vector_result vector;
BEGIN
    -- Parse the text to array
    SELECT ARRAY(
        SELECT unnest::float
        FROM json_array_elements_text(embedding_input::json) AS unnest
    ) INTO parsed_array;

    -- Validate dimensions
    IF array_length(parsed_array, 1) != 1536 THEN
        RAISE EXCEPTION 'Invalid embedding dimensions: %. Expected 1536.', array_length(parsed_array, 1);
    END IF;

    -- Convert to vector
    vector_result = parsed_array::vector(1536);
    RETURN vector_result;
END;
$$;

-- Function to update a single record
CREATE OR REPLACE FUNCTION convert_single_embedding(pattern_id UUID)
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
BEGIN
    -- Get current embedding
    SELECT embedding::text INTO old_embedding
    FROM vector_patterns
    WHERE id = pattern_id;

    IF old_embedding IS NULL THEN
        RETURN QUERY
        SELECT
            pattern_id,
            'unknown'::TEXT,
            'unknown'::TEXT,
            0,
            'ERROR: No embedding found'::TEXT;
        RETURN;
    END IF;

    -- Try conversion
    BEGIN
        new_vector := convert_embedding_to_vector(old_embedding);

        -- Update the record
        UPDATE vector_patterns
        SET embedding = new_vector
        WHERE id = pattern_id;

        -- Return success result
        RETURN QUERY
        SELECT
            pattern_id,
            'text'::TEXT,
            'vector'::TEXT,
            array_length(new_vector::float[], 1),
            'SUCCESS'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        -- Return error result
        RETURN QUERY
        SELECT
            pattern_id,
            'text'::TEXT,
            'failed'::TEXT,
            0,
            'ERROR: ' || SQLERRM;
    END;
END;
$$;

-- Function to convert all embeddings
CREATE OR REPLACE FUNCTION convert_all_embeddings(
    dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    successful_conversions INTEGER,
    failed_conversions INTEGER,
    error_messages TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    success_count INTEGER := 0;
    fail_count INTEGER := 0;
    errors TEXT[] := ARRAY[]::TEXT[];
    conversion_result RECORD;
BEGIN
    -- Iterate through all records
    FOR rec IN SELECT id FROM vector_patterns WHERE embedding IS NOT NULL
    LOOP
        IF NOT dry_run THEN
            SELECT * FROM convert_single_embedding(rec.id) INTO conversion_result;

            IF conversion_result.status LIKE 'SUCCESS%' THEN
                success_count := success_count + 1;
            ELSE
                fail_count := fail_count + 1;
                errors := array_append(errors, 'ID ' || rec.id || ': ' || conversion_result.status);
            END IF;
        ELSE
            -- In dry run, just validate without updating
            BEGIN
                PERFORM convert_embedding_to_vector(embedding::text)
                FROM vector_patterns
                WHERE id = rec.id;

                success_count := success_count + 1;
            EXCEPTION WHEN OTHERS THEN
                fail_count := fail_count + 1;
                errors := array_append(errors, 'ID ' || rec.id || ': ' || SQLERRM);
            END;
        END IF;
    END LOOP;

    RETURN QUERY SELECT success_count, fail_count, errors;
END;
$$;