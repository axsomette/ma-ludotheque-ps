-- Bons plans : recherche ciblée par jeu (page de recherche Dealabs) en plus des flux RSS.
-- Identifiant unique par numéro de bon plan (« dealabs:<numéro> ») pour fusionner les deux sources,
-- et statut « promo terminée ».
alter table public.deals add column if not exists is_expired boolean not null default false;

delete from public.deals d using public.deals e
  where d.id <> e.id and substring(d.link from '(\d{4,})$') = substring(e.link from '(\d{4,})$') and d.id > e.id;
update public.deals set id = 'dealabs:' || substring(link from '(\d{4,})$')
  where id not like 'dealabs:%' and substring(link from '(\d{4,})$') is not null;

-- Quota de recherches ciblées (une par fiche d'achat ouverte).
create or replace function public.take_quota(fn text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  max_per_hour int;
  n int;
begin
  if uid is null then return false; end if;
  max_per_hour := case fn
    when 'search-cover' then 300
    when 'save-cover' then 200
    when 'fetch-scans' then 200
    when 'market-price' then 200
    when 'search-deals' then 200
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
