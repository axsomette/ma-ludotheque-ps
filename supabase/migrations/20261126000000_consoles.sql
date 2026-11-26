-- Nintendo Switch, Switch 2, Xbox 360, Xbox One et Xbox Series X|S, en plus des PlayStation.
alter table public.games drop constraint if exists games_platform_check;
alter table public.games add constraint games_platform_check
  check (platform in ('ps3', 'ps4', 'ps5', 'switch', 'switch2', 'x360', 'xone', 'xseries'));

alter table public.deals drop constraint if exists deals_platform_check;
alter table public.deals add constraint deals_platform_check
  check (platform is null or platform in ('ps3', 'ps4', 'ps5', 'switch', 'switch2', 'x360', 'xone', 'xseries'));
