-- Enable the vector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the vector_patterns table
CREATE TABLE IF NOT EXISTS vector_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    pattern_name TEXT NOT NULL,
    content JSONB NOT NULL,
    embedding vector(1536),
    effectiveness_score FLOAT DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMPTZ,
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    agent_id UUID NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vector_patterns_room_id ON vector_patterns(room_id);
CREATE INDEX IF NOT EXISTS idx_vector_patterns_type ON vector_patterns(type);
CREATE INDEX IF NOT EXISTS idx_vector_patterns_embedding ON vector_patterns USING hnsw (embedding vector_cosine_ops);

-- Enable Row Level Security
ALTER TABLE vector_patterns ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for authenticated users
CREATE POLICY "Enable all operations for authenticated users"
    ON vector_patterns
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create a policy that allows read-only access for anonymous users
CREATE POLICY "Enable read-only access for anonymous users"
    ON vector_patterns
    FOR SELECT
    TO anon
    USING (true);