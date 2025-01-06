-- Enable JSONB operations if not already enabled
CREATE EXTENSION IF NOT EXISTS "pg_jsonb_ops";

-- Add claude_usage_metrics column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'vector_patterns'
        AND column_name = 'claude_usage_metrics'
    ) THEN
        ALTER TABLE vector_patterns
        ADD COLUMN claude_usage_metrics JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add pattern_reuse_hints column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'vector_patterns'
        AND column_name = 'pattern_reuse_hints'
    ) THEN
        ALTER TABLE vector_patterns
        ADD COLUMN pattern_reuse_hints JSONB DEFAULT jsonb_build_object(
            'key_features', '[]'::jsonb,
            'integration_points', '[]'::jsonb,
            'example_combinations', '[]'::jsonb
        );
    END IF;
END $$;

-- Create index on new columns for better query performance
CREATE INDEX IF NOT EXISTS idx_vector_patterns_claude_usage_metrics ON vector_patterns USING gin (claude_usage_metrics);
CREATE INDEX IF NOT EXISTS idx_vector_patterns_pattern_reuse_hints ON vector_patterns USING gin (pattern_reuse_hints);
