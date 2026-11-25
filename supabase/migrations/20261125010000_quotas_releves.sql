-- Quotas horaires relevés : ranger sa collection d'un coup (recherches, changements de plateforme,
-- scans de toute la collection) dépassait les 60 appels par heure prévus par 20261118000000_quotas.sql.
-- Les plafonds restent bornés pour qu'un compte jetable ne puisse pas épuiser le quota IGDB ou LaunchBox.
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
