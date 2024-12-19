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

    -- Convert to vector using direct cast
    vector_result = parsed_array::vector;

    -- Verify dimensions
    IF vector_dims(vector_result) != 1536 THEN
        RAISE EXCEPTION 'Vector conversion failed. Expected 1536 dimensions, got %', vector_dims(vector_result);
    END IF;

    RETURN vector_result;
END;
$$;