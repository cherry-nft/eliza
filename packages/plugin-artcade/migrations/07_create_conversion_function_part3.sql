-- Drop existing function first
DROP FUNCTION IF EXISTS convert_all_embeddings(BOOLEAN);

-- Function to convert all embeddings
CREATE OR REPLACE FUNCTION convert_all_embeddings(
    dry_run BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    success_count INTEGER := 0;
    fail_count INTEGER := 0;
    errors TEXT[] := ARRAY[]::TEXT[];
    conversion_result RECORD;
    result JSON;
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

    -- Create JSON result
    SELECT json_build_object(
        'successful_conversions', success_count,
        'failed_conversions', fail_count,
        'error_messages', errors
    ) INTO result;

    RETURN result;
END;
$$;