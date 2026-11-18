-- Quotas par utilisateur (audit de sécurité du 18/11/2026, constat M1) :
-- un compte jetable ne doit pas pouvoir épuiser à lui seul la base, le stockage ou les API tierces.

-- 1. Listes bornées (le dos n'en affiche que 3).
alter table public.games drop constraint if exists games_genres_max;
alter table public.games add constraint games_genres_max check (cardinality(genres) <= 10);
alter table public.games drop constraint if exists games_screenshots_max;
alter table public.games add constraint games_screenshots_max check (cardinality(screenshots) <= 10);

-- 2. Au plus 1 000 jeux par utilisateur.
create or replace function public.games_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.games where user_id = new.user_id) >= 1000 then
    raise exception 'Limite de 1 000 jeux atteinte.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.games_limit() from public, anon, authenticated;

drop trigger if exists games_limit on public.games;
create trigger games_limit before insert on public.games
  for each row execute function public.games_limit();

-- 3. Au plus 4 000 fichiers par dossier utilisateur dans le bucket covers (5 Mo maximum chacun).
drop policy if exists "covers: dépôt dans son dossier" on storage.objects;
create policy "covers: dépôt dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'covers' and (storage.foldername(o.name))[1] = (select auth.uid())::text
    ) < 4000
  );

-- 4. Appels aux Edge Functions : compteur horaire par utilisateur.
-- Table sans aucune politique RLS : illisible et inaccessible directement ; seule take_quota y écrit.
create table if not exists public.api_calls (
  user_id uuid not null references auth.users (id) on delete cascade,
  fn_name text not null,
  at      timestamptz not null default now()
);
create index if not exists api_calls_user_fn_at_idx on public.api_calls (user_id, fn_name, at desc);
alter table public.api_calls enable row level security;
revoke all on public.api_calls from anon, authenticated;

-- Limites fixées ici (jamais par l'appelant) : un appel direct ne fait que consommer son propre quota,
-- et le nombre de lignes reste borné (une ligne par appel accepté, purge au-delà de 24 h).
create or replace function public.take_quota(fn text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  max_per_hour int;
  n int;
begin
  if uid is null then return false; end if;
  max_per_hour := case fn
    when 'search-cover' then 60
    when 'save-cover' then 60
    when 'fetch-scans' then 60
    else null
  end;
  if max_per_hour is null then raise exception 'Fonction inconnue : %', fn; end if;
  delete from public.api_calls where user_id = uid and at < now() - interval '24 hours';
  select count(*) into n from public.api_calls
    where user_id = uid and fn_name = fn and at > now() - interval '1 hour';
  if n >= max_per_hour then return false; end if;
  insert into public.api_calls (user_id, fn_name) values (uid, fn);
  return true;
end $$;
revoke all on function public.take_quota(text) from public, anon;
grant execute on function public.take_quota(text) to authenticated;
