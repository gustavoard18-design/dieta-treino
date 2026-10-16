# ADRs · Dieta Treino

App para celular que ajuda pessoas a seguir o treino e a dieta no dia a dia e a acompanhar peso e medidas com gráficos, com lembretes dentro do app. A primeira versão é gratuita, para até 100 pessoas, feita sob medida com ferramentas gratuitas, em até 1 mês e com cuidados de privacidade da LGPD.

Gerado em 16/10/2026 a partir da entrevista de projeto. **Atualizado em 16/10/2026** com o que foi implementado e com as decisões tomadas durante o desenvolvimento (ADRs 0007 a 0010).

| ADR | Título | Status |
|---|---|---|
| 0001 | App web instalável (PWA), lojas depois | Aceito · implementado |
| 0002 | Backend gerenciado gratuito (Supabase) | Aceito · implementado |
| 0003 | Login com e-mail e senha, acesso restrito aos próprios dados | Aceito · implementado, alterado pelo 0008 |
| 0004 | Lembretes por notificações do próprio app | Aceito · implementado |
| 0005 | Hospedagem gratuita com HTTPS | Aceito · implementado no GitHub Pages |
| 0006 | Dados de saúde conforme a LGPD | Aceito · implementado, com pendências |
| 0007 | Registro de refeição por foto com IA | Aceito · implementado |
| 0008 | Acesso somente por convite | Aceito · implementado |
| 0009 | Dados de cada pessoa em um registro único, com cópias de segurança | Aceito · implementado |
| 0010 | Serviço de e-mail próprio para confirmação e recuperação | Proposto · pendente |

---

## ADR 0001: Construir um app web instalável (PWA) para celular, com publicação nas lojas depois dos testes

**Status:** Aceito · implementado

### Contexto
Os usuários usarão o app principalmente no celular. O cliente quer começar pelo navegador e só depois dos testes publicar nas lojas, com prazo de 1 mês e sem verba.

### Decisão
Criar um app web feito para celular (PWA), que pode ser aberto pelo navegador e adicionado à tela inicial. Depois dos testes, empacotar o mesmo código para Google Play e App Store.

### Implementação
- Arquivo único `index.html` + `alimentos.js` (base TACO/IBGE com 2.534 alimentos), `manifest.json`, ícones PNG e `sw.js` (service worker).
- Funciona sem internet (cache do service worker) e pode ser instalado: botão nativo no Android/Chrome e passo a passo no iPhone.
- Aviso de nova versão com botão **Atualizar**; a versão é gravada pelo script `publicar.sh`.

### Alternativas consideradas
- **App nativo separado para Android e iPhone:** Exige dois desenvolvimentos, tem custo de contas nas lojas e não cabe no prazo de 1 mês nem na falta de verba.
- **Site comum sem recursos de app:** Não permite ser instalado nem enviar lembretes, e dificulta a futura publicação nas lojas.
- **Ferramenta pronta que monta o app sem programar:** O cliente escolheu um app sob medida, com mais liberdade de personalização.

### Consequências
- ✅ Um único código funciona em qualquer celular
- ✅ Os testes começam rápido, sem passar pela aprovação das lojas
- ✅ Dá para empacotar para as lojas depois, reaproveitando o trabalho
- ✅ Não há custo de publicação na fase de testes
- ⚠️ No iPhone, o app instalado e o Safari guardam dados separados; quem usa sem conta pode perder dados ao apagar o ícone (ver ADR 0009)
- ⚠️ A publicação nas lojas depois exigirá trabalho extra e pagamento das contas de desenvolvedor

---

## ADR 0002: Usar um backend gerenciado gratuito com banco de dados relacional

**Status:** Aceito · implementado

### Contexto
O app precisa guardar treinos, refeições, peso e medidas de até 100 pessoas. Não há verba e a manutenção ficará com o cliente ou sua equipe.

### Decisão
Usar o Supabase (plano gratuito): banco Postgres, login, regras de acesso por linha (RLS), funções no servidor (Edge Functions) e agendador (pg_cron).

### Implementação
- Projeto `dieta-treino`. Tabelas: `app_state`, `app_state_hist`, `lembretes`, `push_inscricoes`, `push_config`, `foto_uso`, `foto_teste`, `foto_teste_contas`, `foto_contas_liberadas`. Todas com RLS e apagadas em cascata quando a conta é excluída.
- Funções: `analisa-foto`, `lembretes-push`, `exclui-conta`. Scripts SQL em `supabase.sql` e `supabase/*.sql`.

### Alternativas consideradas
- **Servidor próprio feito do zero:** Leva mais tempo, exige manutenção constante e dificulta cumprir o prazo de 1 mês.
- **Planilhas online como banco de dados:** Não oferece segurança adequada para dados de saúde.
- **Firebase (banco não relacional):** O banco relacional facilita relatórios futuros, como a área para personal e nutricionista.

### Consequências
- ✅ Custo zero para 100 usuários
- ✅ Pouca manutenção de infraestrutura
- ⚠️ O plano gratuito **pausa projetos sem uso por cerca de uma semana**; com o app em uso diário isso não ocorre, mas convém abrir o painel periodicamente
- ⚠️ Os registros do dia a dia ficam em um bloco JSON por pessoa (ADR 0009), o que exige converter para tabelas antes de criar relatórios ou a área para profissionais

---

## ADR 0003: Login com e-mail e senha, com acesso restrito aos próprios dados

**Status:** Aceito · implementado · alterado pelo ADR 0008 (cadastro só por convite)

### Decisão
Login por e-mail e senha pelo Supabase Auth, com confirmação de e-mail e regras que limitam cada usuário aos seus próprios registros.

### Implementação
- Confirmação de e-mail ligada; o link de confirmação abre o app (Site URL configurado).
- **Esqueci minha senha** por e-mail, com tela de nova senha no app.
- Mensagens de erro em português.
- Modo **"usar sem conta"** (dados só no aparelho), com aviso antes de entrar e faixa fixa lembrando o risco.

### Consequências
- ✅ Segurança testada, sem reinventar o login
- ✅ Permite recuperar a conta em outro aparelho
- ⚠️ O envio de e-mails padrão do Supabase permite poucos e-mails por hora — ver ADR 0010

---

## ADR 0004: Enviar lembretes por notificações do próprio app

**Status:** Aceito · implementado

### Decisão
Notificações push da web (PWA), com a pessoa escolhendo os horários e os dias dos lembretes. Quando o app for para as lojas, passar a usar as notificações nativas.

### Implementação
- Aba Evolução → **Lembretes**: tipos treino, café da manhã, almoço, lanche, jantar, água, pesagem e medidas; horário e dias da semana à escolha; ativar, pausar e apagar.
- Tabela `lembretes`; inscrições dos aparelhos em `push_inscricoes`; chaves VAPID geradas pelo próprio servidor (nenhuma chave manipulada à mão).
- O agendador `pg_cron` chama a função `lembretes-push` a cada 5 minutos; ela envia os lembretes do horário (janela de 30 min) uma vez por dia e remove aparelhos desinscritos.
- O aviso de fim do jejum continua local (com o app aberto ou em segundo plano).

### Consequências
- ✅ Sem custo de envio; chega com o app fechado
- ⚠️ No iPhone, só funciona com o app adicionado à tela inicial (iOS 16.4+) — o app avisa
- ⚠️ Precisão de até 5 minutos em relação ao horário escolhido
- ⚠️ O usuário pode negar a permissão e deixar de receber lembretes

---

## ADR 0005: Hospedar o app em plataforma gratuita com HTTPS

**Status:** Aceito · implementado no **GitHub Pages**

### Decisão
Hospedar no GitHub Pages (repositório `gustavoard18-design/dieta-treino`), com publicação a cada `git push` pelo script `publicar.sh`. Endereço: https://gustavoard18-design.github.io/dieta-treino/

### Alternativas consideradas
- **Vercel, Netlify ou Cloudflare Pages:** Equivalentes em custo e HTTPS. A Vercel permitiria **repositório privado** e prévias por alteração; fica como opção se o código precisar ser fechado ou se houver domínio próprio.
- **Link de artifact do Claude:** Descartado — bloqueia a conexão com o Supabase.

### Consequências
- ✅ Custo zero e HTTPS automático
- ⚠️ No plano gratuito o repositório precisa ser público (o código fica visível; nenhuma chave secreta está nele)
- ⚠️ Mudar de endereço depois exige que quem instalou o app adicione de novo à tela inicial

---

## ADR 0006: Tratar dados de saúde conforme a LGPD

**Status:** Aceito · implementado, com pendências do cliente

### Decisão
Coletar só o necessário, pedir consentimento claro, publicar política de privacidade, permitir que o usuário exporte e exclua seus dados, e proteger o acesso com criptografia e regras por usuário.

### Implementação
- **Consentimento no primeiro uso** (versão da política registrada): aceite da política + autorização para dados de saúde, obrigatórios; **análise de fotos por IA em consentimento separado e opcional**, revogável a qualquer momento.
- **Política de Privacidade** em `privacidade.html`, com dados coletados, base legal (art. 11, I), operadores (Supabase, Anthropic, GitHub), transferência internacional, prazos e direitos.
- Aba Evolução → **Privacidade**: revogar a IA e **excluir a conta** (função `exclui-conta`, apaga em cascata dados, cópias de segurança e fotos).
- **Exportação**: "Baixar cópia" em Cópias de segurança.
- **Retenção**: cópias automáticas por 60 dias; miniaturas do teste de fotos apagadas após 30 dias (`pg_cron`).
- Se a política mudar, o app pede consentimento de novo.

### Pendências do cliente
- ⚠️ Preencher na política **o nome do controlador e o e-mail de contato** (hoje há marcadores `[NOME DO RESPONSÁVEL PELO APP]` e `[E-MAIL DE CONTATO]`).
- ⚠️ Definir quem atende os pedidos dos titulares (prazo informado: 15 dias).
- ⚠️ Recomendável revisão por profissional jurídico antes de abrir para as 100 pessoas.

---

## ADR 0007: Registro de refeição por foto com inteligência artificial

**Status:** Aceito · implementado · 15/10/2026

### Contexto
Registrar cada alimento é a parte mais trabalhosa do app. A IA pode identificar os alimentos e estimar as gramas a partir de uma foto, mas tem custo por uso e envia dados a um terceiro.

### Decisão
- Análise rápida com **Claude Haiku 5.5** (≈ US$ 0,0004 por foto) e botão **"Analisar melhor"** com **Claude Sonnet 5.5** (≈ US$ 0,008).
- A foto é reduzida no celular (1024 px) e enviada à função `analisa-foto`; a chave da Anthropic fica só no servidor.
- A pessoa sempre **revisa e corrige** alimentos e gramas antes de salvar; cada item é ligado à base TACO com busca tolerante a erros.
- **Limites:** 20 análises rápidas e 20 detalhadas por dia, por conta; **só contas liberadas** (`foto_contas_liberadas`) e com consentimento de IA.
- Teste Haiku × Sonnet com contas marcadas (`foto_teste_contas`), guardando os dois resultados para comparação.

### Alternativas consideradas
- **Só Sonnet:** melhor qualidade, ~20× mais caro.
- **Só Haiku:** mais barato, erra mais em pratos misturados.

### Consequências
- ✅ Registro muito mais rápido
- ✅ Custo máximo controlado por conta e por lista de liberados
- ⚠️ Não é gratuito: o cliente paga a Anthropic (recomendado definir limite mensal no Console)
- ⚠️ As gramas são estimativas (erro típico de 20–30%)
- ⚠️ Fotos são enviadas aos EUA — exige consentimento específico (ADR 0006)

---

## ADR 0008: Acesso somente por convite

**Status:** Aceito · implementado · 15/10/2026

### Contexto
O app é público na internet e a IA tem custo. Com cadastro aberto, qualquer pessoa poderia criar contas e gerar gastos.

### Decisão
Desligar o cadastro livre no Supabase. Novas pessoas entram por **convite** (Authentication → Users → Invite); o link do convite abre o app na tela "Crie sua senha".

### Consequências
- ✅ Controle de quem usa, adequado ao limite de 100 pessoas
- ✅ Evita contas falsas
- ⚠️ Cada nova pessoa precisa ser convidada manualmente
- ⚠️ Convites dependem do envio de e-mails (ADR 0010)

---

## ADR 0009: Dados de cada pessoa em um registro único, com cópias de segurança

**Status:** Aceito · implementado · 13–15/10/2026

### Contexto
O app precisa funcionar sem internet e sincronizar entre aparelhos sem perder registros. Houve um caso real de perda de dados de um usuário que usava o modo sem conta.

### Decisão
- Os dados do dia a dia de cada pessoa ficam em um documento JSON (`app_state`), salvo primeiro no aparelho e enviado à conta logo depois.
- A sincronização **sempre junta** aparelho e conta (refeições, treinos, pesos, medidas somam sem repetir); itens apagados ficam marcados para não voltarem.
- "Sair" só limpa o aparelho depois de enviar tudo; "apagar tudo" pede para digitar APAGAR.
- Cópia automática no servidor (`app_state_hist`) antes de mudanças — no máximo 1 por hora e sempre que algo diminui — por 60 dias; recuperação e exportação em arquivo pelo app.

### Consequências
- ✅ Funciona offline e entre aparelhos sem perder dados
- ✅ Recuperação de erros pelas cópias de segurança
- ⚠️ Relatórios e área para profissionais exigirão migrar para tabelas separadas
- ⚠️ No modo sem conta, os dados continuam só no aparelho

---

## ADR 0010: Serviço de e-mail próprio para confirmação, convite e recuperação de senha

**Status:** Proposto · pendente (depende do cliente)

### Contexto
O envio de e-mails padrão do Supabase serve apenas para testes: permite poucos e-mails por hora e costuma cair no spam. Isso já causou bloqueio no cadastro de um usuário. Com convites para 100 pessoas, o limite seria atingido.

### Decisão
Configurar um SMTP próprio no Supabase (Authentication → Emails → SMTP Settings) usando um serviço com plano gratuito, como **Resend** (3.000 e-mails/mês) ou **Brevo** (300/dia). Exige um domínio próprio para melhor entrega.

### Consequências
- ✅ E-mails chegam rápido e com menos chance de spam
- ✅ Permite personalizar remetente e textos em português
- ⚠️ O cliente precisa criar a conta no serviço de e-mail e, de preferência, ter um domínio
