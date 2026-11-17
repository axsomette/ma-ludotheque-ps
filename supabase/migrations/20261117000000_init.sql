-- Ma ludothèque PS : schéma initial.
-- Chaque utilisateur ne voit et ne modifie que ses propres jeux (RLS).

create table if not exists public.games (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  platform     text not null check (platform in ('ps3', 'ps4', 'ps5')),
  igdb_id      bigint,
  cover_url    text check (cover_url is null or char_length(cover_url) <= 2048),
  release_year integer check (release_year is null or release_year between 1990 and 2100),
  created_at   timestamptz not null default now()
);

create index if not exists games_user_created_idx on public.games (user_id, created_at desc);

alter table public.games enable row level security;

drop policy if exists "games: lecture de ses jeux" on public.games;
create policy "games: lecture de ses jeux" on public.games
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "games: ajout pour soi" on public.games;
create policy "games: ajout pour soi" on public.games
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "games: modification de ses jeux" on public.games;
create policy "games: modification de ses jeux" on public.games
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "games: suppression de ses jeux" on public.games;
create policy "games: suppression de ses jeux" on public.games
  for delete to authenticated using (user_id = (select auth.uid()));

-- Jaquettes : bucket public en lecture (les textures 3D doivent se charger sans jeton),
-- écriture limitée au dossier de l'utilisateur : covers/<user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lecture via l'API (nécessaire au dépôt en mode upsert de save-cover).
drop policy if exists "covers: lecture de son dossier" on storage.objects;
create policy "covers: lecture de son dossier" on storage.objects
  for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "covers: dépôt dans son dossier" on storage.objects;
create policy "covers: dépôt dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "covers: remplacement dans son dossier" on storage.objects;
create policy "covers: remplacement dans son dossier" on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "covers: suppression dans son dossier" on storage.objects;
create policy "covers: suppression dans son dossier" on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
