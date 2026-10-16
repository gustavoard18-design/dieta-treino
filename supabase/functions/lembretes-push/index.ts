// Lembretes por notificação push (ADR 0004).
// GET               → devolve a chave pública VAPID (cria o par de chaves na primeira vez e guarda em push_config)
// POST {acao:"enviar"} → chamado pelo agendador do banco a cada 5 min: envia os lembretes cujo horário chegou hoje
// POST {acao:"teste"}  → envia uma notificação de teste para os aparelhos de quem chamou
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const TEXTOS: Record<string, [string, string]> = {
  treino: ["🏋️ Hora do treino", "Seu treino de hoje está te esperando."],
  cafe: ["🍳 Café da manhã", "Não esqueça de registrar o café da manhã."],
  almoco: ["🍽️ Almoço", "Registre o almoço no app."],
  lanche: ["🍎 Lanche", "Hora do lanche — registre no app."],
  jantar: ["🍲 Jantar", "Registre o jantar no app."],
  agua: ["💧 Água", "Beba um copo de água e marque no app."],
  peso: ["⚖️ Pesagem", "Hora de se pesar e registrar."],
  medidas: ["📏 Medidas", "Hora de registrar suas medidas."],
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function chaves() {
  const { data } = await admin.from("push_config").select("publica, privada").eq("id", 1).maybeSingle();
  if (data) return data;
  const novas = webpush.generateVAPIDKeys();
  await admin.from("push_config").upsert({ id: 1, publica: novas.publicKey, privada: novas.privateKey });
  const { data: salvas } = await admin.from("push_config").select("publica, privada").eq("id", 1).single();
  return salvas!;
}

async function envia(userId: string, titulo: string, corpo: string) {
  const { data: subs } = await admin.from("push_inscricoes").select("endpoint, p256dh, auth").eq("user_id", userId);
  let ok = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ titulo, corpo }),
        { TTL: 3600 },
      );
      ok++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_inscricoes").delete().eq("endpoint", s.endpoint); // aparelho desinscrito
    }
  }
  return ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const k = await chaves();
  webpush.setVapidDetails("mailto:contato@dieta-treino.app", k.publica, k.privada);
  if (req.method === "GET") return resposta({ chave: k.publica });

  const corpo = await req.json().catch(() => ({}));

  if (corpo.acao === "teste") {
    const usuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await usuario.auth.getUser();
    if (!user) return resposta({ erro: "Entre na sua conta." }, 401);
    const n = await envia(user.id, "🔔 Lembretes ativados", "Você vai receber os lembretes neste aparelho.");
    return resposta({ enviados: n });
  }

  if (corpo.acao === "enviar") {
    // Agora em Brasília
    const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
    const hora = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}:00`;
    // Janela de 30 min: não dispara lembrete antigo de horas atrás se o agendador ficou parado
    const inicio = new Date(agora.getTime() - 30 * 60000);
    const horaInicio = agora.getDate() === inicio.getDate()
      ? `${String(inicio.getHours()).padStart(2, "0")}:${String(inicio.getMinutes()).padStart(2, "0")}:00` : "00:00:00";
    const { data: devidos } = await admin.from("lembretes").select("id, user_id, tipo")
      .eq("ativo", true).contains("dias", [agora.getDay()]).lte("hora", hora).gt("hora", horaInicio)
      .or(`ultimo_envio.is.null,ultimo_envio.lt.${hoje}`);
    let enviados = 0;
    for (const l of devidos ?? []) {
      const [titulo, texto] = TEXTOS[l.tipo] ?? ["🔔 Lembrete", "Abra o app."];
      enviados += await envia(l.user_id, titulo, texto);
      await admin.from("lembretes").update({ ultimo_envio: hoje }).eq("id", l.id);
    }
    return resposta({ lembretes: devidos?.length ?? 0, enviados });
  }
  return resposta({ erro: "Ação inválida." }, 400);
});
