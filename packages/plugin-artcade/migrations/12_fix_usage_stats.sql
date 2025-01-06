-- Add usage_stats column
ALTER TABLE vector_patterns
ADD COLUMN IF NOT EXISTS usage_stats JSONB DEFAULT jsonb_build_object(
    'total_uses', 0,
    'successful_reuses', 0,
    'last_used', null,
    'effectiveness_by_context', '{}'::jsonb
);

-- Update scoring weights for pattern types
UPDATE vector_patterns
SET effectiveness_score = effectiveness_score * 2
WHERE type = 'game_mechanic';
