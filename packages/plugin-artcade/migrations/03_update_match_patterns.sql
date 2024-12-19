-- Function to extract semantic tags from room_id
CREATE OR REPLACE FUNCTION extract_semantic_tags(room_id text)
RETURNS TABLE (
    tag_type text,
    tags text[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'use_cases'::text, string_to_array(split_part(room_id, '-', 1), '_') WHERE split_part(room_id, '-', 1) != '00000000'
    UNION ALL
    SELECT 'mechanics'::text, string_to_array(split_part(room_id, '-', 2), '_') WHERE split_part(room_id, '-', 2) != '0000'
    UNION ALL
    SELECT 'interactions'::text, string_to_array(split_part(room_id, '-', 3), '_') WHERE split_part(room_id, '-', 3) != '0000'
    UNION ALL
    SELECT 'visual_style'::text, string_to_array(split_part(room_id, '-', 4), '_') WHERE split_part(room_id, '-', 4) != '0000';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate semantic boost
CREATE OR REPLACE FUNCTION calculate_semantic_boost(pattern_room_id text, query_text text)
RETURNS float AS $$
DECLARE
    boost float := 0;
    tag record;
BEGIN
    -- Extract tags from room_id
    FOR tag IN SELECT * FROM extract_semantic_tags(pattern_room_id)
    LOOP
        -- Check if any tag matches the query
        IF query_text = ANY(tag.tags) THEN
            -- Weight boost based on tag type
            CASE tag.tag_type
                WHEN 'use_cases' THEN boost := boost + 0.4;
                WHEN 'mechanics' THEN boost := boost + 0.3;
                WHEN 'interactions' THEN boost := boost + 0.2;
                WHEN 'visual_style' THEN boost := boost + 0.1;
            END CASE;
        END IF;
    END LOOP;

    RETURN boost;
END;
$$ LANGUAGE plpgsql;

-- Updated match_patterns function with semantic boosting
CREATE OR REPLACE FUNCTION match_patterns(
    query_embedding vector(1536),
    query_text text,
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    pattern_name text,
    type text,
    content jsonb,
    effectiveness_score float,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.pattern_name,
        p.type,
        p.content,
        p.effectiveness_score,
        (
            (1 - (p.embedding <=> query_embedding)) +
            calculate_semantic_boost(p.room_id, query_text)
        ) AS similarity
    FROM vector_patterns p
    WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;