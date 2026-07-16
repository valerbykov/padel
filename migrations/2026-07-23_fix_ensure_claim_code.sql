-- 2026-07-23_fix_ensure_claim_code.sql
-- Фикс генерации claim-кода: колонка profiles.claim_code — uuid, а функция
-- писала в неё text (gen_random_uuid()::text) → «column "claim_code" is of type
-- uuid but expression is of type text», кнопка «Link» молча падала.
-- Теперь v_code объявлен uuid, наружу по-прежнему отдаём text (клиент ждёт строку).
-- Идемпотентно. Запускать в Supabase SQL editor.

create or replace function public.ensure_claim_code(p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_code uuid; v_user uuid;
begin
  select user_id into v_user from profiles where id = p_profile_id;
  if not found then raise exception 'profile_not_found'; end if;
  if v_user is not null then raise exception 'already_has_account'; end if;  -- только гость
  if not exists (
    select 1 from group_members gm
    where gm.profile_id = p_profile_id and is_group_admin(gm.group_id)
  ) then raise exception 'forbidden'; end if;
  select claim_code into v_code from profiles where id = p_profile_id;
  if v_code is null then
    v_code := gen_random_uuid();
    update profiles set claim_code = v_code where id = p_profile_id;
  end if;
  return v_code::text;
end; $$;
