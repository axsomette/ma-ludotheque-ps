-- Liste d'envies : jeux que l'utilisateur veut acheter, avec un prix maximum facultatif.
-- Les prix viennent de la table deals (bons plans) ; last_seen_price retient le meilleur prix déjà vu,
-- pour signaler une baisse.
create table if not exists public.wishlist (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  platform        text not null check (platform in ('ps3', 'ps4', 'ps5', 'switch', 'switch2', 'x360', 'xone', 'xseries')),
  igdb_id         bigint,
  thumb_url       text check (thumb_url is null or char_length(thumb_url) <= 2048),
  -- Fiche IGDB du jeu (pour le ranger dans la collection une fois acheté), bornée en taille.
  candidate       jsonb check (candidate is null or pg_column_size(candidate) <= 16000),
  max_price       numeric(8, 2) check (max_price is null or max_price between 0 and 100000),
  last_seen_price numeric(8, 2) check (last_seen_price is null or last_seen_price between 0 and 100000),
  created_at      timestamptz not null default now()
);
create index if not exists wishlist_user_created_idx on public.wishlist (user_id, created_at desc);
create unique index if not exists wishlist_user_platform_igdb_key on public.wishlist (user_id, platform, igdb_id) where igdb_id is not null;

alter table public.wishlist enable row level security;
drop policy if exists "wishlist: lecture" on public.wishlist;
create policy "wishlist: lecture" on public.wishlist for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "wishlist: ajout" on public.wishlist;
create policy "wishlist: ajout" on public.wishlist for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "wishlist: modification" on public.wishlist;
create policy "wishlist: modification" on public.wishlist for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "wishlist: suppression" on public.wishlist;
create policy "wishlist: suppression" on public.wishlist for delete to authenticated using (user_id = (select auth.uid()));

-- Au plus 500 envies par utilisateur.
create or replace function public.wishlist_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.wishlist where user_id = new.user_id) >= 500 then
    raise exception 'Limite de 500 jeux dans la liste d''envies atteinte.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.wishlist_limit() from public, anon, authenticated;
drop trigger if exists wishlist_limit on public.wishlist;
create trigger wishlist_limit before insert on public.wishlist for each row execute function public.wishlist_limit();
