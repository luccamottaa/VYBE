-- Trava (lease) do envio de push: só uma execução do push-send por vez, e se uma morrer
-- no meio a trava vence sozinha. Só o service_role (as Edge Functions) pode chamar.
create or replace function public.push_claim(secs int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  got boolean;
begin
  insert into public.app_state (key, value, updated_at)
  values ('push_lock', jsonb_build_object('until', now() + make_interval(secs => secs)), now())
  on conflict (key) do update
    set value = excluded.value, updated_at = now()
    where (public.app_state.value ->> 'until')::timestamptz < now()
  returning true into got;
  return coalesce(got, false);
end;
$$;

revoke all on function public.push_claim(int) from public, anon, authenticated;
grant execute on function public.push_claim(int) to service_role;
