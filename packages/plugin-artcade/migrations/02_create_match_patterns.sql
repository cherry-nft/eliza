create or replace function match_patterns (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  pattern_name text,
  type text,
  content jsonb,
  effectiveness_score float,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    vector_patterns.id,
    vector_patterns.pattern_name,
    vector_patterns.type,
    vector_patterns.content,
    vector_patterns.effectiveness_score,
    1 - (vector_patterns.embedding <=> query_embedding) as similarity
  from vector_patterns
  where 1 - (vector_patterns.embedding <=> query_embedding) > match_threshold
  order by vector_patterns.embedding <=> query_embedding
  limit match_count;
end;
$$;