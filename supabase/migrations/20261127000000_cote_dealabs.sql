-- Origine de la cote enregistrée sur un jeu : annonces eBay, ou estimation d'après les prix neufs Dealabs.
alter table public.games
  add column if not exists value_source text check (value_source is null or value_source in ('ebay', 'dealabs'));
