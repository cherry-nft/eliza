-- First, copy data to a temporary column
ALTER TABLE vector_patterns
ADD COLUMN IF NOT EXISTS usage_stats_temp JSONB;

UPDATE vector_patterns
SET usage_stats_temp = usage_stats;

-- Drop and recreate usage_stats with correct structure
ALTER TABLE vector_patterns
DROP COLUMN usage_stats;

ALTER TABLE vector_patterns
ADD COLUMN usage_stats JSONB DEFAULT jsonb_build_object(
    'total_uses', 0,
    'successful_uses', 0,
    'average_similarity', 0,
    'last_used', null
);

-- Copy back the data, converting successful_reuses to successful_uses
UPDATE vector_patterns
SET usage_stats = jsonb_build_object(
    'total_uses', COALESCE((usage_stats_temp->>'total_uses')::int, 0),
    'successful_uses', COALESCE((usage_stats_temp->>'successful_reuses')::int, 0),
    'average_similarity', COALESCE((usage_stats_temp->>'average_similarity')::float, 0),
    'last_used', usage_stats_temp->>'last_used'
)
WHERE usage_stats_temp IS NOT NULL;

-- Clean up
ALTER TABLE vector_patterns
DROP COLUMN usage_stats_temp;
