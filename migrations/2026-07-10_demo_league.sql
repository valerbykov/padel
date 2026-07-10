-- Демо-лига («Демо-стая»): персональная песочница новичка. RPC создаёт лигу
-- с 8 гостевыми профилями-собаками (имена на языке пользователя) и ~60 матчами
-- за последние 9 недель (по четвергам и субботам — живой «пульс» и «дни стаи»),
-- затем пересчитывает рейтинги существующей recompute_group_ratings.
-- Пользователь — владелец своей демо-лиги: может сам создать игру с собаками,
-- внести счёт и увидеть, как двигается таблица. Идемпотентно: одна демо-лига
-- на пользователя. Применить в Supabase → SQL editor.
-- (Будущие игры и демо-турнир — вторым шагом, после сверки схем games/tournaments.)

alter table groups add column if not exists is_demo boolean not null default false;

create or replace function public.create_demo_league(p_lang text default 'ru')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
  gid uuid;
  code text;
  names text[];
  lg_name text;
  dogs uuid[] := '{}';
  d uuid;
  i int; w int; j int;
  a1 int; a2 int; b1 int; b2 int;
  s int[] := array[86, 74, 65, 58, 52, 47, 40, 33]; -- «сила» собак: у лиги есть вожак и щенок
  diff int; sa int; sb int;
  ts timestamptz;
begin
  if me is null then
    raise exception 'profile_required';
  end if;

  -- Идемпотентно: если демо уже есть — возвращаем его.
  select g.id, g.invite_code, g.name into gid, code, lg_name
    from groups g
    join group_members gm on gm.group_id = g.id
    where g.is_demo and gm.profile_id = me
    limit 1;
  if gid is not null then
    return jsonb_build_object('id', gid, 'name', lg_name, 'invite_code', code,
      'role', 'owner', 'members_can_add', false, 'members_can_create', false,
      'is_demo', true, 'existing', true);
  end if;

  if p_lang = 'en' then
    names := array['Baron','Rex','Buddy','Daisy','Luna','Max','Bella','Toby'];
    lg_name := 'Demo pack 🐕';
  elsif p_lang = 'es' then
    names := array['Barón','Rex','Toby','Luna','Nala','Coco','Kira','Simba'];
    lg_name := 'Manada demo 🐕';
  else
    names := array['Барон','Шарик','Жуля','Кнопка','Багира','Рекс','Белка','Тузик'];
    lg_name := 'Демо-стая 🐕';
  end if;

  -- Уникальный код приглашения (формат как у обычных лиг).
  loop
    code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    exit when not exists (select 1 from groups where invite_code = code);
  end loop;

  insert into groups (name, owner_id, invite_code, members_can_add, members_can_create, is_demo)
    values (lg_name, me, code, false, false, true)
    returning id into gid;
  insert into group_members (group_id, profile_id, role) values (gid, me, 'owner');

  -- Собаки-гости с аватарами стаи.
  for i in 1..8 loop
    insert into profiles (name, avatar_url)
      values (names[i], '/avatars/dog-' || lpad(i::text, 2, '0') || '.webp')
      returning id into d;
    dogs := dogs || d;
    insert into group_members (group_id, profile_id, role) values (gid, d, 'member');
  end loop;

  -- История: 9 недель × 7 матчей (4 в четверг, 3 в субботу). Пары — детерминированная
  -- ротация, счёт — от «силы» пары с шумом; редкие ничьи. Будущие даты пропускаем.
  for w in reverse 0..8 loop
    for j in 1..7 loop
      i := w * 7 + j;
      ts := date_trunc('week', now()) - make_interval(weeks => w)
            + make_interval(days => case when j <= 4 then 3 else 5 end)  -- чт / сб
            + interval '18 hours' + make_interval(mins => 35 * (j - 1));
      continue when ts > now();
      a1 := 1 + (i % 8); a2 := 1 + ((i + 3) % 8);
      b1 := 1 + ((i + 5) % 8); b2 := 1 + ((i + 6) % 8);
      diff := (s[a1] + s[a2]) - (s[b1] + s[b2]) + ((i * 17) % 21) - 10;
      if diff = 0 then
        sa := 5; sb := 5;                                  -- ничья
      elsif diff > 0 then
        sa := 6; sb := 2 + (i % 3);
      else
        sa := 2 + (i % 3); sb := 6;
      end if;
      insert into matches (group_id, team_a, team_b, sets_a, sets_b, played_at)
        values (gid, array[dogs[a1], dogs[a2]], array[dogs[b1], dogs[b2]], sa, sb, ts);
    end loop;
  end loop;

  -- Рейтинги, matches_played, wins и история rating_changes — штатным пересчётом.
  perform recompute_group_ratings(gid);

  return jsonb_build_object('id', gid, 'name', lg_name, 'invite_code', code,
    'role', 'owner', 'members_can_add', false, 'members_can_create', false,
    'is_demo', true, 'existing', false);
end; $$;

grant execute on function create_demo_league(text) to authenticated;
