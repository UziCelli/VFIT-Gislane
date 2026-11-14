# Conector do Claude (MCP) — passagem para o Codex (14/11/2026)

> Escrito porque o limite do Claude acabou no meio da Entrega 1. **Leia primeiro `docs/plano-conector-claude.md`** (plano e decisões do Victor). Este arquivo diz só onde parou e o que falta.

## Objetivo (resumo)
O Victor (personal, não programa, TDAH: respostas curtas, em tópicos, pt-BR) conecta o app no claude.ai como conector personalizado, pergunta sobre os alunos e pede para o Claude montar mesociclos.
- O Claude pode ler **tudo do aluno, inclusive a anamnese** (OK do Victor).
- O treino criado pelo Claude é sempre **rascunho (PRÓXIMO)**; o Victor confere no editor e toca em "Começar hoje".
- O Claude nunca apaga nada e nunca mexe nas cargas dos alunos.

## Decisões já tomadas (não reabrir)
- Worker Cloudflare novo `vfit-conector`, pasta `conector/`, separado do `push/`. Plano grátis.
- MCP "Streamable HTTP" sem estado (`createMcpHandler` do pacote `agents`) + OAuth com `@cloudflare/workers-oauth-provider` (KV `OAUTH_KV`).
- O conector age **como o coach**: guarda o `refreshToken` do Firebase cifrado nas props da concessão OAuth, troca por `idToken` a cada chamada e fala com o Firestore REST com `Authorization: Bearer`. O `firestore.rules` continua decidindo tudo. **Sem conta de serviço, sem chave mestra.**
- `isCoach()` exige 2º fator: usar `verificarIdToken(..., exigirMfa=true)` de `push/src/jwt.ts` e exigir `usuarios/<uid>.papel == 'coach'`.
- Login: `/authorize` → app `#/conectar-claude?pedido=<id>` (pedido de uso único, 10 min) → coach entra com e-mail, senha e código de 6 dígitos → Permitir/Cancelar → app envia `idToken` + `refreshToken` → Worker valida → `completeAuthorization`.
- Nada é logado (nem token, nem dado de aluno).

## Entregas
1. **PR 1 — leitura** (em andamento, ver abaixo).
2. PR 2 — escrita: `criar_meso`, `ajustar_meso` (detalhes no plano).
3. PR 3 — Gislane: rota por marca (`/gislane/mcp`), como o `push` faz com `PROJETOS`.

## Atualização final (o agente `dev` seguiu escrevendo até o limite acabar)
Também já existem, **todos como rascunho, sem typecheck/test/build e sem revisão**:
- App: `src/features/conta/ConectarClaude.tsx` + rota em `src/App.tsx`; `VITE_CONECTOR_URL` em `.env.production`; ajustes em `firebase.json` (CSP), `package.json`, `vite.config.ts`, `playwright.config.ts`.
- Política de Privacidade: `Politica.tsx` e `src/lib/privacidade.ts`.
- Testes: `conector/src/{ferramentas,login,rest}.test.ts`, `e2e/conectar-claude.spec.ts`.
- `.github/workflows/conector.yml`.
O que falta de fato: rodar tudo, corrigir, `docs/mapa.md` + `graphify update .`, revisão e CI. Ignore os itens "Falta fazer" abaixo que já aparecem aqui.

## Situação da Entrega 1 (WIP, nada testado ainda)
Um agente `dev` começou a escrever em `conector/` e foi interrompido. **Não passou por typecheck, testes nem revisão.** Trate como rascunho e confira cada arquivo.

Já existe (parcial):
- `conector/package.json` + `package-lock.json`, `tsconfig.json`, `wrangler.toml` (KV `OAUTH_KV`, vars `MCP_RESOURCE`, `APP_URL`, `PROJETO`). `FIREBASE_API_KEY` não fica no toml: o workflow lê `VITE_FIREBASE_API_KEY` de `.env.production` e passa com `--var`.
- `conector/src/rest.ts`: valores Firestore REST → JS (Timestamp vira `Ts`, com `toMillis`, para reaproveitar `lerAnamnese`/`lerAvaliacao`/`lerDor`/`lerCheckin`).
- `conector/src/firestore.ts`: `trocarToken` (securetoken), cliente REST com Bearer, `ErroConector`, mensagem `RECONECTAR`.
- `conector/src/ferramentas.ts`: ferramentas de leitura como funções puras (importa `src/engine`, `src/lib/*`, `exercicios.json` por caminho relativo).
- `conector/src/index.ts` (entrada do Worker), `login.ts` (validação do login) e `execucao.ts`: **criados depois da 1ª versão desta nota; só existem como rascunho, não foram revisados nem rodaram.** Leia-os antes de aproveitar.

**Falta fazer** (nada disso existe ainda):
- Conferir/completar `index.ts` (OAuth provider + rota `/mcp` + `/authorize` + `/health`, 4 ferramentas com `zod`) e `login.ts` (recebe `idToken` + `refreshToken` do app; valida MFA + papel coach + pedido de uso único).
- Tela `#/conectar-claude` no app (`src/`), variável `VITE_CONECTOR_URL`, URL do conector no `connect-src` da CSP em `firebase.json`.
- Testes Vitest: conversão REST (ida e volta), validação das ferramentas, pedido vencido/reusado, token sem 2º fator ou sem papel coach, e e2e da tela.
- Workflow `.github/workflows/conector.yml` (igual ao `push.yml`: publica ao mudar `conector/**` e confere `/mcp` sem token = 401).
- Política de Privacidade (`Politica.tsx`): frase de que o coach pode usar o assistente Claude (Anthropic) para analisar treino e anamnese e montar o treino.
- `docs/mapa.md`: seção do conector + linha em "Pontos sensíveis"; depois `graphify update .`.

Ferramentas da Entrega 1: `listar_alunos`, `ver_aluno(alunoId)`, `ver_mesos(alunoId)` (resumido por exercício e semana, para não estourar o contexto), `catalogo_exercicios`.

## Regras do repositório (CLAUDE.md)
- Fluxo: implementar → `typecheck`, `test`, `build` → revisão do diff → PR **em rascunho** → CI → juntar só com o comentário "Revisão cruzada: OK" do outro agente.
- TDD no motor e nas regras. Textos em pt-BR. `pt-topo` em cabeçalhos no topo.
- `graphify query` antes de grepar; `graphify update .` depois de mudar código. `graphify-out/cache/last_query_stamp` é sujeira: `git checkout --` nele.
- Avisar o Victor em 2–3 tópicos curtos.

## Riscos para conferir no 1º uso real
- O `idToken` renovado precisa manter `sign_in_second_factor`; se não mantiver, o Firestore nega e a ferramenta pede "conecte de novo".
- App Check em "Aplicar" quebra a leitura do Worker (avisar antes de ligar).
- O token da Cloudflare pode não ter permissão de **KV**: o deploy falha; o Victor precisa dar essa permissão.
- LGPD: dados de saúde passam pelo Claude → Política de Privacidade atualizada no PR 1.

## Pendências do Victor (depois do deploy do PR 1)
- Dar permissão de KV ao token da Cloudflare (se o deploy pedir).
- No claude.ai: Configurações → Conectores → adicionar conector personalizado com a URL `https://vfit-conector.vfitcoach-site.workers.dev/mcp` → entrar com o código de 6 dígitos → Permitir → testar "liste meus alunos".
