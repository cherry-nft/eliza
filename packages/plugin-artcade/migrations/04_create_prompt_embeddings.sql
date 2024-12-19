-- Enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create the prompt_embeddings table
CREATE TABLE IF NOT EXISTS prompt_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Matching and Results
    matched_pattern_ids UUID[] DEFAULT '{}',
    selected_pattern_id UUID,

    -- Success Metrics
    success_score FLOAT DEFAULT 0.0,
    user_feedback TEXT,

    -- Context
    session_id UUID,
    project_context TEXT,

    -- Metadata
    semantic_tags JSONB DEFAULT '{}',
    response_time_ms INTEGER,

    -- Relations
    FOREIGN KEY (selected_pattern_id) REFERENCES vector_patterns(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS prompt_embeddings_embedding_idx ON prompt_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS prompt_embeddings_user_id_idx ON prompt_embeddings(user_id);
CREATE INDEX IF NOT EXISTS prompt_embeddings_created_at_idx ON prompt_embeddings(created_at);

-- Create a function to match prompts with patterns
CREATE OR REPLACE FUNCTION match_prompts_with_patterns(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM prompt_embeddings p
    WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;