-- Function to convert all records with safety checks
CREATE OR REPLACE FUNCTION convert_all_records()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    total_records INTEGER;
    converted_count INTEGER := 0;
    failed_count INTEGER := 0;
    error_list TEXT[] := ARRAY[]::TEXT[];
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    rec RECORD;
    conversion_result RECORD;
BEGIN
    -- Get start time
    start_time := clock_timestamp();

    -- Count total records
    SELECT COUNT(*) INTO total_records
    FROM vector_patterns
    WHERE embedding IS NOT NULL;

    -- Process each record
    FOR rec IN SELECT id FROM vector_patterns WHERE embedding IS NOT NULL
    LOOP
        BEGIN
            SELECT * FROM convert_single_embedding(rec.id) INTO conversion_result;

            IF conversion_result.status LIKE 'SUCCESS%' THEN
                converted_count := converted_count + 1;
            ELSE
                failed_count := failed_count + 1;
                error_list := array_append(error_list,
                    format('ID %s: %s', rec.id, conversion_result.status));
            END IF;

            -- Log progress every 10 records
            IF MOD(converted_count + failed_count, 10) = 0 THEN
                RAISE NOTICE 'Progress: % of % records processed',
                    converted_count + failed_count, total_records;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            failed_count := failed_count + 1;
            error_list := array_append(error_list,
                format('ID %s: Unexpected error - %s', rec.id, SQLERRM));
        END;
    END LOOP;

    -- Get end time
    end_time := clock_timestamp();

    -- Return summary
    RETURN json_build_object(
        'total_records', total_records,
        'converted_count', converted_count,
        'failed_count', failed_count,
        'errors', error_list,
        'duration_seconds', EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER,
        'start_time', start_time,
        'end_time', end_time
    );
END;
$$;