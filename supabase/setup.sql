-- Zênite Fibra – base vetorial do suporte
-- Rode UMA VEZ no Supabase: Dashboard → SQL Editor → New query → Run

create extension if not exists vector;

-- Tabela exclusiva da base de conhecimento da Zênite
-- 1536 = dimensão do modelo text-embedding-3-small (OpenAI)
create table if not exists suporte_zenite (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536)
);

create index if not exists suporte_zenite_embedding_idx
  on suporte_zenite using hnsw (embedding vector_cosine_ops);

-- Função de busca usada pelo nó "Supabase Vector Store" do n8n
create or replace function match_suporte_zenite (
  query_embedding vector(1536),
  match_count int default null,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (suporte_zenite.embedding <=> query_embedding) as similarity
  from suporte_zenite
  where metadata @> filter
  order by suporte_zenite.embedding <=> query_embedding
  limit match_count;
end;
$$;
