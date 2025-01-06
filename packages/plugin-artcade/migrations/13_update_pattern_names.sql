-- Update pattern names to use spaces instead of hyphens
UPDATE vector_patterns
SET pattern_name = 'First Person Movement'
WHERE pattern_name = 'first-person-movement';

UPDATE patterns
SET pattern_name = 'Air Hockey Physics AI'
WHERE pattern_name = 'air-hockey-physics-ai';

UPDATE patterns
SET pattern_name = 'Game State Initialization'
WHERE pattern_name = 'game-state-initialization';

UPDATE patterns
SET pattern_name = 'Keyboard Shooter Movement'
WHERE pattern_name = 'keyboard-shooter-movement';

UPDATE patterns
SET pattern_name = 'Game Loop And Rendering'
WHERE pattern_name = 'game-loop-and-rendering';

-- Add any other hyphenated pattern names here
