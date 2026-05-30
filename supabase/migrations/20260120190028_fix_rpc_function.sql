create or replace function match_knowledge_base_articles (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_business_id uuid
)
returns table (
  id uuid,
  content text,
  title text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    id,
    content,
    title,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_base_articles
  where business_id = p_business_id
  and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
end;
$$;
