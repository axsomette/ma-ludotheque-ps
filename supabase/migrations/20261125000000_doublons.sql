-- Pas de doublon dans une collection : un même jeu IGDB ne peut être rangé qu'une fois par plateforme.
-- (Le même jeu sur PS4 et PS5 reste possible : ce sont deux boîtiers différents.)
-- L'appli vérifie déjà avant l'ajout ; l'index bloque aussi deux ajouts simultanés (double appui).
-- Les jeux sans fiche IGDB (photo gardée comme jaquette) sont comparés par titre dans l'appli seulement.
create unique index if not exists games_user_platform_igdb_key
  on public.games (user_id, platform, igdb_id)
  where igdb_id is not null;
