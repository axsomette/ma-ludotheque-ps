-- Prix personnels : ce que l'exemplaire a coûté, et la cote saisie à la main (prioritaire sur l'estimation eBay).
alter table public.games
  add column if not exists purchase_price numeric(8, 2) check (purchase_price is null or purchase_price between 0 and 100000),
  add column if not exists manual_value   numeric(8, 2) check (manual_value is null or manual_value between 0 and 100000);
