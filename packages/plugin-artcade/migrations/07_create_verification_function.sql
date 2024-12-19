-- Function to verify vector operations
CREATE OR REPLACE FUNCTION verify_vector_operations(pattern_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    result JSON;
    vec vector;
    vec_dim INTEGER;
    vec_norm FLOAT;
BEGIN
    -- Get the vector
    SELECT embedding INTO vec
    FROM vector_patterns
    WHERE id = pattern_id;

    -- Get dimensions
    SELECT vector_dims(vec) INTO vec_dim;

    -- Get L2 norm
    SELECT vec <-> vec INTO vec_norm;

    -- Create result
    SELECT json_build_object(
        'dimensions', vec_dim,
        'is_vector', vec IS NOT NULL,
        'l2_norm', vec_norm,
        'can_cosine_similarity', vec <=> vec IS NOT NULL
    ) INTO result;

    RETURN result;
END;
$$;