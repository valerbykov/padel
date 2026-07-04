-- =====================================================================
--  FIX: телефонная регистрация падала с 500 "Database error saving new user".
--  Причина: profiles.name NOT NULL, а handle_new_user() вычислял name=NULL
--  при входе по SMS (нет email и нет метаданных с именем).
--  Решение: фолбэки на auth.users.phone и литерал 'Игрок'; phone берём из new.phone.
--  Применяется идемпотентно (create or replace). Запускать в Supabase → SQL Editor.
-- =====================================================================
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
