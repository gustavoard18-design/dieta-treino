// Exclui a conta de quem chamou e, em cascata, todos os dados dela:
// app_state, app_state_hist (cópias), foto_uso, foto_teste, foto_teste_contas, foto_contas_liberadas.
// Direito de eliminação da LGPD (art. 18, VI).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  const usuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await usuario.auth.getUser();
  if (!user) return resposta({ erro: "Entre na sua conta para excluí-la." }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return resposta({ erro: "Não foi possível excluir a conta." }, 500);
  return resposta({ ok: true });
});
