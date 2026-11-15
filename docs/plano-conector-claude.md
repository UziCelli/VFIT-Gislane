# Plano — Conector do Claude (MCP) — 14/11/2026

Objetivo: o Victor conecta o app no claude.ai (Configurações → Conectores → conector personalizado), pergunta sobre os alunos e pede para o Claude montar mesociclos. O Claude grava o meso como **PRÓXIMO** (rascunho); o Victor confere no editor e toca em "Começar hoje".

Decisões do Victor (14/11/2026):
- O Claude pode ler **tudo do aluno, inclusive a anamnese**.
- O treino criado pelo Claude é sempre um rascunho que ele revisa no app.

## Arquitetura
- **Worker Cloudflare novo**, pasta `conector/` (nome `vfit-conector`), separado do `push/`: se ele quebrar, as notificações continuam funcionando. Grátis, na mesma conta e com os mesmos secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- MCP remoto ("Streamable HTTP") **sem estado**: `createMcpHandler` do pacote `agents`, sem Durable Object.
- OAuth exigido pelo claude.ai: `@cloudflare/workers-oauth-provider` (registro dinâmico de cliente, PKCE). Guarda as concessões no KV `OAUTH_KV`, que também é grátis.
- Dependências próprias em `conector/package.json` (com lockfile). O código puro do app é importado por caminho relativo: `src/engine`, `src/lib/conversores.ts`, `src/lib/iaTreino.ts`, `src/data/exercicios.json` e `push/src/jwt.ts` (`verificarIdToken`).
- Workflow `conector.yml`, igual ao `push.yml`: publica ao juntar mudanças em `conector/**` e confere as rotas no ar (sem token = 401).

## Login (segurança)
O conector age **como o Victor**: usa o token dele, e o `firestore.rules` continua decidindo tudo. Nenhuma conta de serviço e nenhuma chave mestra.
1. O claude.ai abre `/authorize` no Worker.
2. O Worker redireciona para o app: `#/conectar-claude?pedido=<id>`.
3. O coach entra normalmente, com e-mail, senha e o **código de 6 dígitos** (o `isCoach()` exige o 2º fator).
4. A tela "Permitir que o Claude veja e monte treinos dos seus alunos?" tem os botões **Permitir** e **Cancelar**.
5. Ao permitir, o app manda ao Worker `idToken` + `refreshToken` do Firebase.
6. O Worker confere o `idToken` com `verificarIdToken(..., exigirMfa = true)`, lê `usuarios/<uid>` com o próprio token e exige `papel == 'coach'`.
7. O Worker completa o OAuth e guarda o `refreshToken` **cifrado** nas `props` da concessão (o workers-oauth-provider cifra com o token de acesso).
8. A cada chamada de ferramenta, o Worker troca o `refreshToken` por um `idToken` novo (`securetoken.googleapis.com`, chave web pública do projeto) e chama a API REST do Firestore com `Authorization: Bearer`.
- O pedido (`pedido`) vale 10 minutos e é de uso único; sem ele, o Worker não aceita os tokens.
- Desconectar no claude.ai apaga a concessão. Nada é logado: nem token, nem dado de aluno.
- CSP do app (`firebase.json`, `connect-src`): incluir a URL do conector.

## Ferramentas (MCP)
Leitura (PR 1):
- `listar_alunos`: nome, status, pago até, meso atual (nome, semana atual, fim) e se tem próximo.
- `ver_aluno(alunoId)`: perfil, anamnese mais recente, última avaliação física, notas do coach, dores e check-ins do Físio.
- `ver_mesos(alunoId)`: mesos (atual, próximo e anteriores) já convertidos com `docParaMeso` + cargas e reps registradas por exercício e semana (`docsParaRegistros`/`normalizarCargas`; peso corporal conforme `docs/peso-corporal.md`).
- `catalogo_exercicios`: nomes do `exercicios.json` e a lista de métodos (`METODOS`).

Escrita (PR 2):
- `criar_meso(alunoId, nome, meso)`: valida (exercícios do catálogo, nº de semanas e treinos, métodos e progressão) com as mesmas regras do assistente de voz (`iaTreino.ts`).
  - Exige `inicio` **no futuro**, para virar PRÓXIMO.
  - Grava como o `salvarMeso` (`mesoParaDoc`, `criadoEm`/`atualizadoEm` = hora do servidor, via `:commit` com transform).
  - Recusa nome repetido no mesmo aluno.
- `ajustar_meso(mesoId, meso)`: só em meso que **ainda não começou**. Troca os campos como o `salvarMeso`, nunca mexe em `sessoes` nem em `registros`.
- Nenhuma ferramenta apaga nada nem grava cargas.

## Entregas
1. **PR 1 — leitura**
   - Worker, OAuth, tela `#/conectar-claude`, as 4 ferramentas de leitura e o workflow.
   - Política de Privacidade (`Politica.tsx`): "o coach pode usar o assistente Claude (Anthropic) para analisar seu treino e anamnese e montar seu treino".
   - Linha nova em "Pontos sensíveis".
2. **PR 2 — escrita**: `criar_meso` e `ajustar_meso`.
3. **PR 3 — Gislane**: mesma pasta, rota por marca (`/gislane/mcp`), como o `push` já faz com `PROJETOS`.

## Critério de pronto
- Testes unitários (Vitest) de:
  - conversão de valores do Firestore REST (ida e volta);
  - validação de cada ferramenta;
  - `pedido` vencido ou reusado → recusa;
  - token sem 2º fator ou sem papel coach → recusa;
  - `ajustar_meso` em meso já começado → recusa.
- `typecheck`, `test` e `build` verdes. E2e da tela `#/conectar-claude` no emulador.
- Depois do deploy: o Victor conecta no claude.ai e o Claude responde "liste meus alunos".

## Riscos
- **2º fator ao renovar o token**: o `idToken` renovado precisa manter `sign_in_second_factor`. Se não mantiver, o Firestore nega e a ferramenta pede "conecte de novo". Conferir no 1º uso real.
- **App Check**: se o Firestore for posto em "Aplicar", o Worker deixa de ler. O conector não tem como gerar o token do App Check. Avisar antes de ligar.
- **Provisionar o KV no deploy**: se o token da Cloudflare não tiver permissão de KV, o deploy falha. A solução é o Victor dar essa permissão ao token.
- **Volume de dados**: `ver_mesos` resumido por exercício e semana, para não estourar o contexto do Claude.
