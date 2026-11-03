-- Chama o push-send a cada 10 minutos. Ele é idempotente: sem chart novo só confere o meta.json
-- e responde "skipped"; com chart novo envia em lotes e retoma de onde parou se não couber numa rodada.
-- É também o que dispara o resumo do dia (9h de Brasília).
create extension if not exists pg_cron;
select cron.schedule(
  'vybe-push-send',
  '*/10 * * * *',
  $$select net.http_post(
      url := 'https://gpwlltfgkaaiqofytuzs.supabase.co/functions/v1/push-send',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );$$
);
