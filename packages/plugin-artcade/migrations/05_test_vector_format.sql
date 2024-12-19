-- Function to create test vectors table
CREATE OR REPLACE FUNCTION create_test_vectors()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    CREATE TABLE IF NOT EXISTS test_vectors (
        id bigserial PRIMARY KEY,
        embedding vector(3)
    );
END;
$$;

-- Function to clean up test vectors table
CREATE OR REPLACE FUNCTION cleanup_test_vectors()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DROP TABLE IF EXISTS test_vectors;
END;
$$;