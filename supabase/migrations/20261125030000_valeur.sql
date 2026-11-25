-- Valeur de la collection : état et édition de l'exemplaire, dernière cote calculée (eBay France).
alter table public.games
  add column if not exists condition  text check (condition is null or condition in ('loose', 'cib', 'new')),
  add column if not exists edition    text not null default 'standard' check (edition in ('standard', 'collector')),
  add column if not exists value_eur  numeric(8, 2) check (value_eur is null or value_eur between 0 and 100000),
  add column if not exists value_low  numeric(8, 2) check (value_low is null or value_low between 0 and 100000),
  add column if not exists value_high numeric(8, 2) check (value_high is null or value_high between 0 and 100000),
  add column if not exists value_n    integer check (value_n is null or value_n between 0 and 1000),
  add column if not exists value_at   timestamptz;

-- Quota horaire de la nouvelle fonction market-price (mêmes règles que les autres).
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
