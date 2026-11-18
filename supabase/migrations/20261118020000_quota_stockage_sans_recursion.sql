-- Correctif de 20261118000000_quotas.sql : la règle d'ajout du bucket « covers » comptait les fichiers
-- de l'utilisateur en relisant storage.objects depuis une règle de storage.objects.
-- Postgres la rejette (42P17, « invalid object definition ») et le stockage renvoyait
-- « The database schema is invalid or incompatible » à chaque dépôt (jaquettes, photos, scans).
-- Le comptage passe par une fonction security definer : elle lit la table sans repasser par ses règles,
-- et ne compte que le dossier de l'appelant (auth.uid()), jamais celui d'un autre.

create or replace function public.my_covers_count() returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from storage.objects o
  where o.bucket_id = 'covers'
    and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;
revoke all on function public.my_covers_count() from public, anon;
grant execute on function public.my_covers_count() to authenticated;

drop policy if exists "covers: dépôt dans son dossier" on storage.objects;
create policy "covers: dépôt dans son dossier" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.my_covers_count()) < 4000
  );
