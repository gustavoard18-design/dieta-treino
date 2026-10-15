// Analisa a foto de uma refeição e devolve os alimentos com gramas estimadas.
// - modo "rapido": Claude Haiku 5.5 (padrão)   - modo "melhor": Claude Sonnet 5.5 (botão "Analisar melhor")
// - teste: true roda os dois modelos e guarda o resultado em foto_teste para comparação
// - limite por conta e por dia: 20 análises rápidas e 20 "melhor" (contadas em foto_uso)
// A chave da Anthropic fica só no servidor, no segredo ANTHROPIC_API_KEY.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const LIMITE_DIA = 20;
const MODELOS = { rapido: "claude-haiku-5-5", melhor: "claude-sonnet-5-5" } as const;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SISTEMA = `Você analisa fotos de refeições para um app brasileiro de dieta.
Liste cada alimento visível separadamente, com a quantidade estimada em gramas do que está no prato.
Use nomes como na Tabela Brasileira de Composição de Alimentos (TACO), incluindo o preparo quando der para ver:
por exemplo "Arroz, tipo 1, cozido", "Feijão, carioca, cozido", "Frango, peito, sem pele, grelhado", "Alface, crespa, crua".
Estime as gramas pelo tamanho do prato, talheres e porções típicas no Brasil.
Inclua molhos, óleo visível, queijo por cima e bebidas se aparecerem.
Se a foto não mostrar comida, devolva a lista vazia e explique em "observacao".`;

const ESQUEMA = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          gramas: { type: "number" },
          confianca: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["nome", "gramas", "confianca"],
        additionalProperties: false,
      },
    },
    observacao: { type: "string" },
  },
  required: ["itens", "observacao"],
  additionalProperties: false,
};

const anthropic = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

async function analisa(modelo: string, imagem: string, tipo: string) {
  const inicio = Date.now();
  const r = await anthropic.messages.create({
    model: modelo,
    max_tokens: 4000,
    system: SISTEMA,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: tipo, data: imagem } },
        { type: "text", text: "Quais alimentos e quantas gramas de cada um estão nesta refeição?" },
      ],
    }],
  });
  if (r.stop_reason === "refusal") throw new Error("A IA não analisou esta foto.");
  const texto = r.content.find((b) => b.type === "text");
  if (!texto || texto.type !== "text") throw new Error("Resposta vazia da IA.");
  return { ...JSON.parse(texto.text), modelo, ms: Date.now() - inicio, uso: r.usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  // Quem está pedindo: valida o login do usuário
  const auth = req.headers.get("Authorization") ?? "";
  const usuario = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await usuario.auth.getUser();
  if (!user) return resposta({ erro: "Entre na sua conta para analisar fotos." }, 401);

  let corpo: { imagem?: string; tipo?: string; modo?: string; teste?: boolean; miniatura?: string };
  try { corpo = await req.json(); } catch { return resposta({ erro: "Pedido inválido." }, 400); }
  const { imagem, miniatura } = corpo;
  const tipo = corpo.tipo === "image/png" ? "image/png" : "image/jpeg";
  const modo = corpo.modo === "melhor" ? "melhor" : "rapido";
  if (!imagem || imagem.length > 2_500_000) return resposta({ erro: "Foto ausente ou grande demais." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Só contas liberadas (tabela foto_contas_liberadas) podem usar a IA
  const { data: liberada } = await admin.from("foto_contas_liberadas").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!liberada) return resposta({ erro: "O registro por foto ainda não foi liberado para a sua conta." }, 403);

  // Limite diário (conta antes de chamar a IA; devolve se a chamada falhar)
  const { data: usadas, error: erroUso } = await admin.rpc("usa_foto", { p_uid: user.id, p_modo: modo, p_limite: LIMITE_DIA });
  if (erroUso) return resposta({ erro: "Não foi possível verificar o limite diário." }, 500);
  if (usadas === -1) {
    return resposta({ erro: `Você usou as ${LIMITE_DIA} análises ${modo === "melhor" ? "detalhadas " : ""}de hoje. Amanhã libera de novo.` }, 429);
  }

  // Teste: pedido pelo app (?teste=fotos) ou conta marcada em foto_teste_contas; só na análise rápida
  const { data: contaTeste } = await admin.from("foto_teste_contas").select("user_id").eq("user_id", user.id).maybeSingle();
  const emTeste = modo === "rapido" && (corpo.teste || !!contaTeste);

  try {
    if (emTeste) {
      const [haiku, sonnet] = await Promise.allSettled([
        analisa(MODELOS.rapido, imagem, tipo),
        analisa(MODELOS.melhor, imagem, tipo),
      ]);
      const val = (p: PromiseSettledResult<unknown>) => p.status === "fulfilled" ? p.value : { erro: String(p.reason) };
      await admin.from("foto_teste").insert({ user_id: user.id, haiku: val(haiku), sonnet: val(sonnet), miniatura: miniatura ?? null });
      if (haiku.status === "rejected") throw haiku.reason;
      return resposta({ ...(haiku.value as object), restantes: LIMITE_DIA - usadas });
    }
    const resultado = await analisa(MODELOS[modo], imagem, tipo);
    return resposta({ ...resultado, restantes: LIMITE_DIA - usadas });
  } catch (e) {
    await admin.rpc("devolve_foto", { p_uid: user.id, p_modo: modo });
    return resposta({ erro: e instanceof Error ? e.message : "Falha ao analisar a foto." }, 502);
  }
});
