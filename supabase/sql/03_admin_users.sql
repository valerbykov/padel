-- =====================================================================
--  PADEL · администратор и расширенный профиль
--  Запускать ПОСЛЕ schema.sql и auth_and_rls.sql.
--  Добавляет: имя/фамилию/телефон/email в профиль, флаг администратора,
--  права администратора и обновлённый триггер регистрации.
-- =====================================================================

-- 1. Расширяем профиль ------------------------------------------------
alter table profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists phone      text,
  add column if not exists email      text,
  add column if not exists is_admin   boolean not null default false;

-- 2. Триггер регистрации теперь заполняет все поля из метаданных -------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, first_name, last_name, phone, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      nullif(trim(concat_ws(' ',
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'last_name')), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      new.phone,                       -- регистрация по телефону: имени/почты нет
      'Игрок'                          -- крайний фолбэк, т.к. profiles.name NOT NULL
    ),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'phone', new.phone),
    new.email
  );
  return new;
end; $$;

-- 3. Helper: является ли текущий пользователь администратором ----------
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where user_id = auth.uid() limit 1), false);
$$;

-- 4. Права администратора (политики SELECT/UPDATE объединяются по OR) ---
create policy "admin reads all profiles"   on profiles      for select using (is_admin());
create policy "admin updates all profiles" on profiles      for update using (is_admin());
create policy "admin manages members"      on group_members for all
  using (is_admin()) with check (is_admin());

-- 5. Назначить ПЕРВОГО администратора (нет смысла автоматизировать —
--    сделай это вручную один раз после своей регистрации):
--    update profiles set is_admin = true where email = 'ТВОЙ_EMAIL';
