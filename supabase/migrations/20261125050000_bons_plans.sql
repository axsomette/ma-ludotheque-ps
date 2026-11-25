-- Bons plans PlayStation relevés dans les flux RSS publics de Dealabs (boutique, prix, date, lien).
-- Alimentée par la fonction sync-deals (clé de service) ; lisible par les utilisateurs connectés.
create table if not exists public.deals (
  id           text primary key check (char_length(id) <= 500),
  title        text not null check (char_length(title) <= 300),
  merchant     text check (merchant is null or char_length(merchant) <= 80),
  price        numeric(8, 2) check (price is null or price between 0 and 100000),
  link         text not null check (char_length(link) <= 500),
  image        text check (image is null or char_length(image) <= 500),
  platform     text check (platform is null or platform in ('ps3', 'ps4', 'ps5')),
  published_at timestamptz not null,
  seen_at      timestamptz not null default now()
);
create index if not exists deals_platform_published_idx on public.deals (platform, published_at desc);

alter table public.deals enable row level security;
revoke all on public.deals from anon;
grant select on public.deals to authenticated;
drop policy if exists "deals: lecture" on public.deals;
create policy "deals: lecture" on public.deals for select to authenticated using (true);

-- Dernière collecte (une ligne par tâche), pour ne pas relire les flux plus d'une fois par quart d'heure.
create table if not exists public.app_state (
  key   text primary key,
  value timestamptz not null
);
alter table public.app_state enable row level security;
revoke all on public.app_state from anon, authenticated;
