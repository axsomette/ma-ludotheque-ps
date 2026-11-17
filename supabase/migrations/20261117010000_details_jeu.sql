-- Détails pour un boîtier réaliste : dos (résumé, captures, éditeur, genres, PEGI)
-- et photos personnelles du dos et du disque.
alter table public.games
  add column if not exists summary      text check (summary is null or char_length(summary) <= 4000),
  add column if not exists publisher    text check (publisher is null or char_length(publisher) <= 200),
  add column if not exists genres       text[] not null default '{}',
  add column if not exists pegi         smallint check (pegi is null or pegi in (3, 7, 12, 16, 18)),
  add column if not exists screenshots  text[] not null default '{}',
  add column if not exists back_url     text check (back_url is null or char_length(back_url) <= 2048),
  add column if not exists disc_url     text check (disc_url is null or char_length(disc_url) <= 2048);

-- Les règles RLS existantes (lecture / ajout / modification / suppression de ses jeux) couvrent ces colonnes.
