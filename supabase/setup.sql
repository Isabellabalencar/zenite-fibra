-- Zênite Fibra – base vetorial do suporte
-- Rode no Supabase: Dashboard → SQL Editor → New query → Run
-- Embeddings: Google Gemini "models/gemini-embedding-001" (3072 dimensões)
-- ATENÇÃO: este script recria a tabela do zero (apaga os dados anteriores).

create extension if not exists vector;

drop function if exists match_suporte_zenite;
drop table if exists suporte_zenite;

create table suporte_zenite (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(3072)
);

-- Sem índice HNSW: o pgvector só indexa vetores de até 2000 dimensões.
-- Para uma base pequena (dezenas de trechos) a busca sem índice é rápida.

-- Função de busca usada pelo nó "Supabase Vector Store" do n8n
create or replace function match_suporte_zenite (
  query_embedding vector(3072),
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
