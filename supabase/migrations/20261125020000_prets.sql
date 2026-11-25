-- Prêts : à qui un jeu est prêté et depuis quand (vide = le jeu est à la maison).
alter table public.games
  add column if not exists loaned_to text check (loaned_to is null or char_length(trim(loaned_to)) between 1 and 80),
  add column if not exists loaned_at date;

-- Les règles RLS existantes (lecture / modification de ses jeux) couvrent ces colonnes.
