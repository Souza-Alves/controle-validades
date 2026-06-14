# Backend Supabase (online + offline)

O app usa o **Supabase** (PostgreSQL na nuvem) como base de dados, mantendo um
**cache local** para funcionar offline. As alterações feitas sem internet ficam
numa fila e são sincronizadas automaticamente quando a conexão volta.

## Como funciona

- **Leitura**: retorna do cache local imediatamente; se online, sincroniza com o
  servidor (envia pendências + baixa o estado atual) e atualiza o cache.
- **Escrita**: grava no cache local na hora e adiciona uma operação à fila
  (`upsert`/`delete`). A fila é enviada ao Supabase quando há internet.
- **Reconexão**: ao voltar a ficar online (evento do `NetInfo`), a fila é enviada
  automaticamente.
- **Migração**: na primeira execução, os dados locais existentes (Excel/localStorage)
  são enviados para o Supabase para não se perderem.

Arquivos principais:
- `src/supabase/index.ts` — cliente Supabase (URL + anon key).
- `src/storage/index.ts` — camada offline-first (cache + fila + sync). A API
  pública é a mesma de antes (`getProdutos`, `addProduto`, etc.), então as telas
  não mudaram.

## Configuração das tabelas

Rode este SQL no **Supabase → SQL Editor → New query → Run** (necessário apenas
uma vez):

```sql
create table if not exists public.locais (
  id text primary key,
  nome text not null,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.produtos (
  id text primary key,
  local_id text,
  local_nome text,
  quantidade integer not null default 0,
  nome text,
  validade text,
  situacao text,
  status text,
  updated_at timestamptz not null default now()
);

alter table public.locais enable row level security;
alter table public.produtos enable row level security;

drop policy if exists "anon_all_locais" on public.locais;
create policy "anon_all_locais" on public.locais
  for all to anon using (true) with check (true);

drop policy if exists "anon_all_produtos" on public.produtos;
create policy "anon_all_produtos" on public.produtos
  for all to anon using (true) with check (true);
```

## Credenciais

A URL e a `anon key` ficam em `src/supabase/index.ts` com valores padrão e podem
ser sobrescritas por variáveis de ambiente (`.env`):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

> A `anon key` é pública (feita para ser embutida no app). **Nunca** coloque a
> `service_role` no app.
