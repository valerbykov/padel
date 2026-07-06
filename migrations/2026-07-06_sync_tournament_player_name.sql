-- Имя игрока в tournament_players — снимок на момент вступления. Для ЗАРЕГИСТРИРОВАННЫХ
-- игроков показываем актуальное имя из профиля. Держим снимок в синхроне триггером +
-- разовый бэкфилл существующих. Гостей (profile_id null) не трогаем.

create or replace function public.sync_tournament_player_name()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  if new.name is distinct from old.name then
    update tournament_players
       set name = new.name
     where profile_id = new.id
       and name is distinct from new.name;
  end if;
  return new;
end; $function$;

drop trigger if exists trg_sync_tournament_player_name on public.profiles;
create trigger trg_sync_tournament_player_name
  after update of name on public.profiles
  for each row execute function public.sync_tournament_player_name();

-- разово синхронизировать уже существующие записи
update public.tournament_players tp
   set name = pr.name
  from public.profiles pr
 where tp.profile_id = pr.id
   and tp.name is distinct from pr.name;
