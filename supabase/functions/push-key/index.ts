// GET → { publicKey } pra inscrição de push no navegador.
import { cors, json, vapidKeys } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  try {
    const { publicKey } = await vapidKeys();
    return json(req, { publicKey });
  } catch (e) {
    return json(req, { error: (e as Error).message }, 500);
  }
});
