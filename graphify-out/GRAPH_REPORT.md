# Graph Report - claude-cloud-celli  (2026-11-14)

## Corpus Check
- 411 files · ~390,860 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: .css 4, (none) 2, .ico 2)

## Summary
- 3703 nodes · 10651 edges · 178 communities (161 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 470 edges (avg confidence: 0.94)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d08ca2f2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- avaliacao.ts
- FisioCoach.tsx
- ataques.test.ts
- Entrar.tsx
- extrair_planilha.py
- Motion & Framer Motion
- planilha.ts
- Hoje.tsx
- engine/index.ts
- env
- seed.ts
- acoes.ts
- log.ts
- EditarTreino.tsx
- util.ts
- cartaoRelatorio.ts
- `src/lib/` — Firestore, estado, cálculos com dados
- steps
- env
- Segurança — passos do Victor no console
- Alertas.tsx
- Presencial.tsx
- prints.spec.ts
- lados.ts
- FimTreino.tsx
- jwt.ts
- vitest
- Estado da sessão (retomada) — atualizado em 10/11/2026
- cartaoStory.ts
- iaTreino.ts
- steps
- steps
- settings.json
- cartaoDepoimento.ts
- Botao
- aluno-exemplo.mjs
- webpush.ts
- Alunos.tsx
- ref_node_fs
- firebase-admin
- Treino.tsx
- VozTreino.tsx
- src/index.ts
- steps
- Plano — Redesenho das telas secundárias (VFITCOACH + Gislane)
- mesoAtual.test.ts
- avisos-pagamento.mjs
- `src/lib/` — Firestore, estado, cálculos com dados
- with
- segmentos.ts
- src/acesso.ts
- compilerOptions
- conversores.test.ts
- Plano — App da Gislane (segunda marca)
- steps
- steps
- scripts
- sugestoesFisio.ts
- ContaAluno.tsx
- steps
- acoesFisio.ts
- SessaoCard.tsx
- ui.tsx
- Motion / Framer Motion Examples
- cadastro.ts
- EnviarFeedback.tsx
- dor.ts
- compilerOptions
- package.json
- vigia.mjs
- Motion & Framer Motion - Complete API Reference
- Hooks
- Plano — Entrega 1 (aprovado pelo Victor)
- GuiaFisio.tsx
- steps
- ImportarPlanilha.tsx
- Descanso
- engine/index.ts
- relogio.spec.ts
- push.yml
- App.tsx
- mfa.ts
- Onde fica cada coisa
- with
- overrides
- criarAluno
- varredura.spec.ts
- 2ª parte (09/11/2026): avisos para o coach, lembrete do treino e aviso escrito
- Performance Optimization
- PagarPix.tsx
- rules.test.ts
- atualizar.ts
- progressaoFisio.ts
- backup.mjs
- Best Practices Summary
- Scroll-Based Animations
- Utilities
- Gesture Props
- Transition Options
- dependencies
- descanso.ts
- Advanced Layout Animations
- Modal & Dialog Patterns
- Loading States
- Page Transitions
- Animation Props
- AnimatePresence
- Roteiro de apresentação do app
- tipos.ts
- gislane/Logo.tsx
- marca.test.ts
- Navigation Menus
- List Animations
- Shared Element Transitions
- Complex Gestures
- Form Animations
- Variants
- Event Info Types
- Layout Props
- MesosDoAluno.tsx
- pdfRelatorio.ts
- BotaoSinal.tsx
- hojeSaoPaulo
- .claude/CLAUDE.md
- session-start.sh
- android-teste.sh
- corpoPaths.ts
- Aviso
- limpeza-lgpd.mjs
- react
- saude.yml
- Revisão do PR #166 — carga por lado
- @playwright/test
- 12/11/2026 — orientação individual dos métodos
- src/ia.ts
- inatividade.ts
- acoes.ts
- 5. Catálogo por queixa (ordem: as que mais aparecem na rotina de academia)
- Árvore por pasta
- limpeza
- marca
- @playwright/test
- env
- Entrar.tsx
- steps
- Avaliacao.tsx
- limpeza-lgpd.yml
- criarMeso
- with
- preparar
- voz-ia.spec.ts
- firebase-admin
- feedback.spec.ts
- Físio — articulações e músculos de cada exercício (para o Victor conferir)
- aluno-exemplo.test.ts
- Pesquisa — Delimitação de volume adequado, lesão e dor (o que a literatura diz)
- norm
- InicioAluno.tsx
- AlunoApp.tsx
- Plano — Entrega 4: registro de erros e segurança
- notasMetodo.ts
- vite.config.ts
- fmtMin
- Botao
- Força — app de treino (substitui a planilha "Força 2027.1")
- erros.mjs
- AGENTS.md
- seriesDoRotulo
- src/index.ts
- pwa-assets.config.ts

## God Nodes (most connected - your core abstractions)
1. `Pontos sensíveis (leia antes de auditar ou mexer)` - 160 edges
2. `Botao()` - 145 edges
3. `Treino()` - 98 edges
4. `react` - 93 edges
5. `vitest` - 85 edges
6. ``src/lib/` — Firestore, estado, cálculos com dados` - 65 edges
7. `firebase` - 63 edges
8. `prescreverSessao()` - 62 edges
9. `Aviso()` - 61 edges
10. `useLista()` - 61 edges

## Surprising Connections (you probably didn't know these)
- `13/11/2026 — Carga por lado (entrega A) e próximo: isometria (entrega B)` --references--> `doisLados()`  [INFERRED]
  docs/estado-sessao.md → src/lib/lados.ts
- `Fase 3 — Isometria` --references--> `limiteDe()`  [INFERRED]
  docs/plano-lados-isometria.md → src/engine/volume.ts
- `Contexto` --references--> `polimento()`  [INFERRED]
  docs/plano-fisio.md → src/engine/volume.ts
- ``src/features/auth/` — Autenticação` --references--> `useSair()`  [INFERRED]
  docs/mapa.md → src/features/auth/BotaoSair.tsx
- `1. Agenda e regras da semana (lógica pura, TDD) — `src/lib/agenda.ts`` --references--> `semanaAtual()`  [INFERRED]
  docs/plano-redesenho.md → src/lib/treino.ts

## Import Cycles
- 2-file cycle: `src/lib/avaliacao.ts -> src/lib/segmentos.ts -> src/lib/avaliacao.ts`

## Communities (178 total, 17 thin omitted)

### Community 0 - "avaliacao.ts"
Cohesion: 0.09
Nodes (30): AvaliacaoForm, BIO, Ciclo, Destaque, DobraId, DOBRAS, FAIXA, forca() (+22 more)

### Community 1 - "FisioCoach.tsx"
Cohesion: 0.11
Nodes (46): ALERTA_GERAL, enviarOrientacao(), marcarDorVista(), recolherOrientacao(), responderDor(), salvarExerciciosFisio(), ConteudoMetodo(), descreverDor() (+38 more)

### Community 2 - "ataques.test.ts"
Cohesion: 0.13
Nodes (15): agora(), ALUNOS, COM_FATOR, comoFirestore(), contexto(), criarReg(), db(), dbEmail() (+7 more)

### Community 3 - "Entrar.tsx"
Cohesion: 0.12
Nodes (26): Logo(), LOGO_COACH, LOGO_PARTES, LOGO_VFIT, LOGO_VIEWBOX, AcaoEmail(), salvar(), ACOES (+18 more)

### Community 4 - "extrair_planilha.py"
Cohesion: 0.08
Nodes (17): col_letters_to_num(), excel_serial_to_date(), extract_divisao(), extract_exercicios(), extract_meso3x_config(), extract_monitoramento(), extract_progressao(), extract_semanas_data() (+9 more)

### Community 5 - "Motion & Framer Motion"
Cohesion: 0.04
Nodes (44): 1. Forgetting AnimatePresence for Exit Animations, 1. Hover Animations, 1. Motion Components, 1. Use Transform Properties, 2. Animate Prop, 2. Individual Transform Properties, 2. Missing key Prop in Lists, 2. Tap/Press Animations (+36 more)

### Community 6 - "planilha.ts"
Cohesion: 0.09
Nodes (32): abaAntigaFalsa(), abaMesoFalsa(), Cel, colNum(), criarXlsx(), criarXlsxBruto(), deflate(), enc (+24 more)

### Community 7 - "Hoje.tsx"
Cohesion: 0.10
Nodes (36): AvisoAtraso(), chave(), jaViu(), AvisoReps(), Hoje(), Msg(), RegistroFlag, Semana() (+28 more)

### Community 8 - "engine/index.ts"
Cohesion: 0.07
Nodes (37): LIMITE_ISOMETRIA_S, linhaIsometrica(), nomes, NOMES_ISOMETRICOS, normalizar(), progressaoIsometrica(), analisarProgressao(), AnaliseProgressao (+29 more)

### Community 9 - "env"
Cohesion: 0.04
Nodes (46): if, needs, runs-on, steps, strategy, AGENDAR, EVENTO, MARCA (+38 more)

### Community 10 - "seed.ts"
Cohesion: 0.10
Nodes (20): ALUNO, COACH, ALUNO, COACH, confere(), semTransbordar(), ALUNO, COACH (+12 more)

### Community 11 - "acoes.ts"
Cohesion: 0.25
Nodes (15): RequisitosSenha(), erroSenha(), SenhaSegura(), conferir(), criarNova(), reautenticar(), trocarSenha(), EstadoSenha (+7 more)

### Community 12 - "log.ts"
Cohesion: 0.12
Nodes (19): App(), Contador, contarDia(), cortar(), empilhar(), enviar(), gravar(), iniciarLog() (+11 more)

### Community 13 - "EditarTreino.tsx"
Cohesion: 0.08
Nodes (60): `src/engine/` — Motor de cálculo puro (sem React/Firebase), COR_METODO, METODOS, ORDEM, adicionarExercicio(), adicionarMetodo(), alternarSerieDropset(), ESCOPOS (+52 more)

### Community 14 - "util.ts"
Cohesion: 0.14
Nodes (37): isometrico(), linhaPrescrita(), Slot, ajustarSeries(), aplicar(), limiteDe(), polimento(), progressaoAutomatica() (+29 more)

### Community 15 - "cartaoRelatorio.ts"
Cohesion: 0.24
Nodes (15): pngDe(), dadosCartaoRelatorio(), DadosRelatorio, dataBr(), gerarCartaoRelatorio(), num(), periodoTexto(), r (+7 more)

### Community 16 - "`src/lib/` — Firestore, estado, cálculos com dados"
Cohesion: 0.08
Nodes (39): apagar(), Caixa(), Campo(), Conteudo(), enviar(), ler(), ModoCoach, Rascunho (+31 more)

### Community 17 - "steps"
Cohesion: 0.05
Nodes (45): concurrency, if, needs, runs-on, steps, strategy, group, BACKUP_SENHA (+37 more)

### Community 18 - "env"
Cohesion: 0.05
Nodes (42): EVENTO, GH_TOKEN, MARCA, PROJETO, SA, marca, jobs, preparar (+34 more)

### Community 19 - "Segurança — passos do Victor no console"
Cohesion: 0.08
Nodes (23): 10. Correções da revisão de 12/11/2026, 1. Identity Platform (liga a verificação em 2 etapas), 1b. Senha mínima no servidor (08/11/2026), 2. Proteção contra enumeração de e-mail (feito), 2b. URL de ação dos e-mails (/acao), 3. App Check (reCAPTCHA Enterprise, invisível), 4. Restringir a chave da API, 5. Auditoria 02/10/2026 (segurança + LGPD) (+15 more)

### Community 20 - "Alertas.tsx"
Cohesion: 0.05
Nodes (81): Proposta em 3 passos (do mais seguro ao maior), `src/features/coach/` — App do coach, DIAS_CURTO, PIX, useHoje(), abertura(), linkBtn, rotulo (+73 more)

### Community 21 - "Presencial.tsx"
Cohesion: 0.21
Nodes (20): `src/` — Raiz, Avatar(), iniciais(), Aluno(), Barra(), EscolherAluno(), Grupo(), guardarRecente() (+12 more)

### Community 22 - "prints.spec.ts"
Cohesion: 0.09
Nodes (11): ANTES, DIAS_AUTO, diasAtras(), ids, marca, NOMES, PROIBIDO, registros() (+3 more)

### Community 23 - "lados.ts"
Cohesion: 0.12
Nodes (22): Ajuste por exercício no meso, Entrega B — decisões e histórico (Codex, 13/11/2026), Estado (13/11/2026), Fase 1 — Catálogo (só dados), Fase 3 — Isometria, Ficam SEM marca (um halter só, ou um lado de cada vez), Isométricos novos (proposta — Victor confere), Marcados como `doisLados` (proposta — Victor confere) (+14 more)

### Community 24 - "FimTreino.tsx"
Cohesion: 0.19
Nodes (13): CONFETE, dur(), FimTreino(), escolher(), Lista(), Cartao(), DadosTreino, IcCamera (+5 more)

### Community 25 - "jwt.ts"
Cohesion: 0.14
Nodes (21): deb64u(), abrir(), agoraOk(), caches, chaveDaConta(), chaveDe(), chaveDoGoogle(), Claims (+13 more)

### Community 26 - "vitest"
Cohesion: 0.08
Nodes (29): Para o Codex continuar (entrega B — isometria), vitest, prancha, mediana(), metaCiclo(), metaRobusta(), evolucaoExercicio(), media() (+21 more)

### Community 27 - "Estado da sessão (retomada) — atualizado em 10/11/2026"
Cohesion: 0.04
Nodes (46): 03/10/2026, 03/10/2026 (tarde) — App da Gislane, 04/10/2026 — Gislane no ar, 04/11/2026 — Editar o treino na hora (presencial), 04/11/2026 — Login que não cai, 2FA menos vezes e concluir com confirmação, 07/10/2026, 08/10/2026 — Redesenho (PR 56), 08/11/2026 — Aba Métodos mais simples (editor do meso) (+38 more)

### Community 28 - "cartaoStory.ts"
Cohesion: 0.23
Nodes (20): `src/features/evolucao/` — Painel de evolução, conquistas, cartão, ajustar(), caixa(), carregarImagem(), DadosCartao, desenhar(), desenharTreino(), desenharTreinoFoto() (+12 more)

### Community 29 - "iaTreino.ts"
Cohesion: 0.13
Nodes (23): Acao, acharPosicao(), descreverAcao(), doCatalogo, ExercicioProposto, FERRAMENTA, inteiroOpc(), inteiros() (+15 more)

### Community 30 - "steps"
Cohesion: 0.05
Nodes (37): env, if, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group (+29 more)

### Community 31 - "steps"
Cohesion: 0.05
Nodes (36): description, options, required, type, description, required, ACAO, EMAIL (+28 more)

### Community 32 - "settings.json"
Cohesion: 0.10
Nodes (20): effortLevel, enabledPlugins, ponytail@ponytail, superpowers@superpowers-marketplace, env, PONYTAIL_DEFAULT_MODE, extraKnownMarketplaces, ponytail (+12 more)

### Community 33 - "cartaoDepoimento.ts"
Cohesion: 0.24
Nodes (11): DadosDepoimento, desenhar(), gerarCartaoDepoimento(), quebrar(), textosDepoimento(), H, W, D_ESTRELA (+3 more)

### Community 34 - "Botao"
Cohesion: 0.16
Nodes (28): `src/features/instalar/` — PWA/Android, BoasVindas(), CartaoInstalar(), deveMostrarBoasVindas(), FolhaIPhone(), ler(), Linha(), marcarBoasVindasVistas() (+20 more)

### Community 35 - "aluno-exemplo.mjs"
Cohesion: 0.08
Nodes (22): 1. Progressão por exercício (acaba principal/auxiliar), 2. Sugestão de biset/triset para caber no tempo, Divisão (agentes Sonnet), Plano — Entrega 2 (fim de principal/auxiliar + encaixar o treino no tempo), [a, m, d], achados, b, db (+14 more)

### Community 36 - "webpush.ts"
Cohesion: 0.15
Nodes (18): RFC-8188, RFC-8292, b64u(), juntar(), assinar(), Inscricao, criptografar(), Efemera (+10 more)

### Community 37 - "Alunos.tsx"
Cohesion: 0.14
Nodes (25): Alunos(), bloquear(), confirmarPix(), liberar(), reativar(), comparar(), ConfirmarAluno(), confirmar() (+17 more)

### Community 38 - "ref_node_fs"
Cohesion: 0.07
Nodes (14): ALUNO, COACH, ALUNO, COACH, marca, ALUNO, COACH, marca (+6 more)

### Community 39 - "firebase-admin"
Cohesion: 0.14
Nodes (5): app, auth, COLECOES, db, SCRIPTS

### Community 40 - "Treino.tsx"
Cohesion: 0.09
Nodes (35): metodoDoRotulo(), AvisoAdaptado(), ExplicacaoMetodo(), Festa, FestaRecorde(), hms(), NotaMetodos(), Novidades() (+27 more)

### Community 41 - "VozTreino.tsx"
Cohesion: 0.09
Nodes (34): ROTULO, VozTreino(), aplicar(), falar(), iniciar(), limpar(), montar(), mudarTexto() (+26 more)

### Community 42 - "src/index.ts"
Cohesion: 0.14
Nodes (27): fetch(), recado(), PROJETOS, Aviso, bytesOk(), endpointOk(), Fixa, hostOk() (+19 more)

### Community 43 - "steps"
Cohesion: 0.06
Nodes (30): description, required, ALUNO, MESO, NOME, SA, if, runs-on (+22 more)

### Community 44 - "Plano — Redesenho das telas secundárias (VFITCOACH + Gislane)"
Cohesion: 0.25
Nodes (7): 1. Agenda e regras da semana (lógica pura, TDD) — `src/lib/agenda.ts`, 2. App do aluno, 3. App do coach, 4. Entrada, Ordem, Plano — Redesenho das telas secundárias (VFITCOACH + Gislane), Regras que não mudam

### Community 45 - "mesoAtual.test.ts"
Cohesion: 0.22
Nodes (8): 1. Volume: progressão e redução (motor em `src/engine/volume.ts`, TDD), 2. Tela do coach (editor do meso), 3. Treino do dia em destaque (aluno), 4. Carga fantasma, 5. Peso corporal (PC), 6. Novidades (tutorial), Divisão (agentes Sonnet; ninguém no mesmo arquivo), Plano — volume (progressão/redução), treino do dia, PC, carga fantasma, novidades

### Community 46 - "avisos-pagamento.mjs"
Cohesion: 0.21
Nodes (14): assinarJwt(), base64url(), diaBrasilia(), diaDaSemana(), DIAS_AUTO, emMillis(), executar(), numeroDoDia() (+6 more)

### Community 47 - "`src/lib/` — Firestore, estado, cálculos com dados"
Cohesion: 0.05
Nodes (64): Critério de pronto, Cálculo (`src/lib/avaliacao.ts`, puro, com testes), Modelo de dados, Plano — Fase 3: avaliação física e relatório escrito de evolução (09/11/2026), Regras (`firestore.rules`), Riscos, Telas, v2 (10/11/2026): tela do aluno resumida, cores de evolução e leitura medida x dobra (+56 more)

### Community 48 - "with"
Cohesion: 0.07
Nodes (31): if, runs-on, steps, if, runs-on, steps, jobs, app (+23 more)

### Community 49 - "segmentos.ts"
Cohesion: 0.12
Nodes (23): DESCE, Leitura, lerSegmento(), PAR_DOBRA, REGIAO, RelatorioAvaliacao, Ocorrencia, cargaPorSegmento() (+15 more)

### Community 50 - "src/acesso.ts"
Cohesion: 0.17
Nodes (16): acessoComCache(), Campos, ehCoach(), lerPerfil(), lerPermissao(), liberado(), podeAvisarTreino(), quemAvisaCoach() (+8 more)

### Community 51 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, jsx, lib, module, moduleResolution, noEmit, paths, resolveJsonModule (+6 more)

### Community 52 - "conversores.test.ts"
Cohesion: 0.11
Nodes (23): Entregas, Pontos sensíveis (leia antes de auditar ou mexer), Segurança — revisão 12/11/2026, Fase 2 — Carga por lado, dados(), nadaPassaDaTela(), versao(), cancelarTreino() (+15 more)

### Community 53 - "Plano — App da Gislane (segunda marca)"
Cohesion: 0.14
Nodes (13): 1. Mesmo código, duas marcas (não copiar o repositório), 2. Banco de dados: um projeto Firebase para cada coach, 3. Endereço (decidir antes de ela ter alunos), 4. APK Android, Andamento, Checklist antes de começar (Victor/Gislane), Cuidados, Decisões recomendadas (e por quê) (+5 more)

### Community 54 - "steps"
Cohesion: 0.07
Nodes (26): if, runs-on, steps, description, required, description, required, EMAIL_ATUAL (+18 more)

### Community 55 - "steps"
Cohesion: 0.08
Nodes (27): concurrency, cancel-in-progress, group, if, runs-on, steps, SA, if (+19 more)

### Community 56 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, build:gislane, dev, dev:gislane, emuladores, icones, icones:gislane (+5 more)

### Community 57 - "sugestoesFisio.ts"
Cohesion: 0.13
Nodes (23): COLECAO_DORES, RelatoDor, diaDe(), Entrada, ev(), Gatilho, gatilhosConversar(), gatilhosPolimento() (+15 more)

### Community 58 - "ContaAluno.tsx"
Cohesion: 0.10
Nodes (47): AvisoNotificacoes(), permissao(), AvisoDescanso(), ContaAluno(), escolherFoto(), trocarSenha(), desde(), Mensalidade() (+39 more)

### Community 59 - "steps"
Cohesion: 0.07
Nodes (26): MARCA, PROJETO, SA, if, runs-on, steps, marca, jobs (+18 more)

### Community 60 - "acoesFisio.ts"
Cohesion: 0.19
Nodes (20): `src/lib/` — Firestore, estado, cálculos com dados, checkinJaExiste(), registrarCheckin(), CheckinFim(), chip(), Estado, MES, CampoCheckin (+12 more)

### Community 61 - "SessaoCard.tsx"
Cohesion: 0.15
Nodes (24): `notas/{alunoId}`, Nota(), BotaoLadosDiferentes(), CampoLados(), fmt(), LoadInput(), Chips(), CORES (+16 more)

### Community 62 - "ui.tsx"
Cohesion: 0.10
Nodes (25): BotaoCompartilhar(), clicar(), compartilharArquivo(), dataCurta(), EvolucaoAluno(), EvolucaoCoach(), Faixa(), Painel() (+17 more)

### Community 63 - "Motion / Framer Motion Examples"
Cohesion: 0.18
Nodes (10): Additional Resources, Carousel with Swipe, Custom Route Transition with Direction Detection, Image Galleries, License, Lightbox Gallery, Motion / Framer Motion Examples, Multi-Stage Route Transition (+2 more)

### Community 64 - "cadastro.ts"
Cohesion: 0.60
Nodes (3): CAMINHO_CADASTRO, emLinkCadastro(), linkCadastro

### Community 65 - "EnviarFeedback.tsx"
Cohesion: 0.14
Nodes (26): Cartao(), chip(), EnviarFeedback(), enviar(), Opcao(), enviarFeedback(), Assunto, ASSUNTOS (+18 more)

### Community 66 - "dor.ts"
Cohesion: 0.12
Nodes (27): `fisioDores/{id automático}` (Etapa 3, 12/11/2026), relatarDor(), chip(), RelatarDor(), ROTULO_LOCAL, vazio(), IcFisio, TODAS (+19 more)

### Community 67 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 68 - "package.json"
Cohesion: 0.11
Nodes (23): devDependencies, @cloudflare/workers-types@^5.20260930.2, @firebase/rules-unit-testing@^5.0.2, firebase-tools@^15.33.0, @playwright/test@^1.63.0, tailwindcss@^4.3.3, @types/react@^19.0.0, @types/react-dom@^19.0.0 (+15 more)

### Community 69 - "vigia.mjs"
Cohesion: 0.18
Nodes (9): agora, alertas, auth, coaches, corte, db, h24, projeto (+1 more)

### Community 70 - "Motion & Framer Motion - Complete API Reference"
Cohesion: 0.20
Nodes (9): Common Patterns Quick Reference, Core Animation Props, Custom Component with Motion, Import Types, Motion Component Props, Motion & Framer Motion - Complete API Reference, Performance Tips, Table of Contents (+1 more)

### Community 71 - "Hooks"
Cohesion: 0.20
Nodes (10): Hooks, useAnimate, useAnimationControls, useInView, useMotionValue, usePresence, useReducedMotion, useScroll (+2 more)

### Community 72 - "Plano — Entrega 1 (aprovado pelo Victor)"
Cohesion: 0.20
Nodes (9): 1. Semana certa ao abrir (aluno), 2. Tempo do treino, 3. Cronômetro manual por exercício, 4. Tempo real do treino, 5. Aviso de biset/triset/superset/circuito, 6. Lista de exercícios (coach, Divisão e trocas), 7. Divisão bonita no PC, Divisão de trabalho (agentes Sonnet; nunca dois no mesmo arquivo) (+1 more)

### Community 73 - "GuiaFisio.tsx"
Cohesion: 0.13
Nodes (22): ALERTA_LOMBAR, ALERTA_TENDAO, AVISO_FISIO, linkPubmed(), MetodoFisio, METODOS_FISIO, Nivel, opcional() (+14 more)

### Community 74 - "steps"
Cohesion: 0.08
Nodes (24): MODO, SA, if, runs-on, steps, modo, jobs, exemplo (+16 more)

### Community 75 - "ImportarPlanilha.tsx"
Cohesion: 0.38
Nodes (9): ImportarPlanilha(), escolher(), importar(), trocarAba(), Previa(), nomeImportado(), importarMeso(), abaSugerida() (+1 more)

### Community 76 - "Descanso"
Cohesion: 0.15
Nodes (6): Descanso, alvosDe(), comAparelho(), inicioDoDiaBrasilia(), nomeDO(), semAparelho()

### Community 77 - "engine/index.ts"
Cohesion: 0.12
Nodes (30): iniciarEdicao(), cobre(), extraTempo(), metodosDaSessao(), prescreverSessao(), slotsDaSessao(), sufixo(), TAMANHO (+22 more)

### Community 78 - "relogio.spec.ts"
Cohesion: 0.16
Nodes (9): COACH, ALUNO, COACH, iniciarEConcluir(), seg(), semear(), criarCoach(), ALUNO (+1 more)

### Community 79 - "push.yml"
Cohesion: 0.08
Nodes (25): concurrency, cancel-in-progress, group, if, runs-on, steps, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (+17 more)

### Community 80 - "App.tsx"
Cohesion: 0.13
Nodes (32): ativaAba(), Coach(), Menu(), Principal(), Vigia(), Doc, Estrelas(), Feedbacks() (+24 more)

### Community 81 - "mfa.ts"
Cohesion: 0.39
Nodes (6): tentar(), chaveManual(), codigoCompleto(), limparCodigo(), mensagemMfa(), msgs

### Community 82 - "Onde fica cada coisa"
Cohesion: 0.18
Nodes (17): Como verificar, Convenção de gravação (TOTAL), Limites conhecidos (aceitos), Marcação automática (`corpoEhCarga`), Normalização de leitura (`normalizarCargas`), Onde fica cada coisa, Peso do corpo nas cargas, `rebasear` e `preencherCorpo` (escrita) (+9 more)

### Community 83 - "with"
Cohesion: 0.08
Nodes (23): if, runs-on, steps, timeout-minutes, GH_TOKEN, jobs, emulador, name (+15 more)

### Community 84 - "overrides"
Cohesion: 0.25
Nodes (8): @grpc/grpc-js, uuid, @opentelemetry/core, overrides, basic-ftp, @firebase/firestore, gaxios, @google-cloud/pubsub

### Community 85 - "criarAluno"
Cohesion: 0.09
Nodes (17): doAluno(), PARQ_NAO, confirmarGrave(), GRAVES, marcar(), mesoDe(), NOVA, PARQ (+9 more)

### Community 87 - "2ª parte (09/11/2026): avisos para o coach, lembrete do treino e aviso escrito"
Cohesion: 0.17
Nodes (11): 2ª parte (09/11/2026): avisos para o coach, lembrete do treino e aviso escrito, Contrato do Worker, Contrato novo do Worker, Critério de pronto, Decisões, Decisões, Lembrete na hora certa (10/11/2026), Notificações: mensalidade e treino pronto (13/10/2026) (+3 more)

### Community 88 - "Performance Optimization"
Cohesion: 0.29
Nodes (7): Exit Before Enter (Reduce Simultaneous Animations), Lazy Motion Component, Performance Optimization, Reuse Variant Objects, Throttle Scroll Events, useReducedMotion Hook, will-change Optimization

### Community 89 - "PagarPix.tsx"
Cohesion: 0.33
Nodes (8): campo(), centavos(), codigoPix(), crc16(), limparChave(), semAcento(), base, valorComAtraso()

### Community 90 - "rules.test.ts"
Cohesion: 0.22
Nodes (11): ALUNOS, COM_FATOR, contexto(), db(), dbEmail(), fator(), futuro, passado (+3 more)

### Community 91 - "atualizar.ts"
Cohesion: 0.70
Nodes (3): atualizarNaEntrada(), deveRecarregar(), versaoDisponivel()

### Community 92 - "progressaoFisio.ts"
Cohesion: 0.06
Nodes (37): Critério do Victor (13/11/2026): progressão demasiada × dor, Decisões suas antes de começar, Físio — proposta A1: cruzar o treino real com as sugestões, O que a pesquisa de volume muda (`docs/fisio-pesquisa-volume.md`, 13/11/2026), O que mudaria para você (em linguagem simples), O que o app continua NÃO fazendo, 10. Monitoramento, Custo de leitura (plano grátis) (+29 more)

### Community 93 - "backup.mjs"
Cohesion: 0.33
Nodes (6): backup, db, lerColecao(), limpa(), projeto, PROJETOS

### Community 94 - "Best Practices Summary"
Cohesion: 0.33
Nodes (6): 1. Use Transform Properties, 2. Respect Accessibility, 3. Optimize Bundle Size, 4. Clean Up Animations, 5. Debounce/Throttle Expensive Operations, Best Practices Summary

### Community 95 - "Scroll-Based Animations"
Cohesion: 0.33
Nodes (6): Parallax Scrolling, Scroll-Based Animations, Scroll-Based Counter, Scroll Progress Indicator, Scroll-Triggered Animation Sequence, Sticky Scroll Sections

### Community 96 - "Utilities"
Cohesion: 0.33
Nodes (6): animate (standalone), clamp, mix, stagger, transform, Utilities

### Community 97 - "Gesture Props"
Cohesion: 0.33
Nodes (6): Gesture Props, whileDrag, whileFocus, whileHover, whileInView, whileTap

### Community 98 - "Transition Options"
Cohesion: 0.33
Nodes (6): Inertia Transitions (Decelerating), Orchestration, Spring Transitions (Physics-based), Transition Interface, Transition Options, Tween Transitions (Duration-based)

### Community 99 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, firebase@^12.19.0, motion@^13.4.6, react@^19.3.0, react-dom@^19.3.0, uqr@^0.1.3, react-dom, uqr

### Community 100 - "descanso.ts"
Cohesion: 0.09
Nodes (27): 1. Método em destaque no treino do aluno, 2. Nota de cada método (substitui o aviso atual do biset), 3. Ícones animados (um por método), 4. Guia de métodos (nova página, para aluno e coach), 5. Cronômetro de descanso que chama a pessoa de volta, Divisão (agentes Sonnet; nunca dois no mesmo arquivo), Plano — Entrega 3: métodos em destaque, guia de métodos e cronômetro que chama de volta, Como funciona (+19 more)

### Community 101 - "Advanced Layout Animations"
Cohesion: 0.40
Nodes (5): Accordion with Layout Animation, Advanced Layout Animations, Expandable Card, Grid to List View Toggle, Masonry Grid with Layout Animation

### Community 102 - "Modal & Dialog Patterns"
Cohesion: 0.40
Nodes (5): Bottom Sheet (Mobile), Confirmation Dialog with Shake, Drawer / Side Panel, Modal & Dialog Patterns, Smooth Modal with Backdrop

### Community 103 - "Loading States"
Cohesion: 0.40
Nodes (5): Content Fade In, Loading States, Progress Bar with Pulse, Skeleton Loading, Spinner with Variants

### Community 104 - "Page Transitions"
Cohesion: 0.40
Nodes (5): Depth Transition (Scale + Blur), Full Page Fade, Page Transitions, Slide Transition, Stack Navigation

### Community 105 - "Animation Props"
Cohesion: 0.40
Nodes (5): animate, Animation Props, exit, initial, style

### Community 106 - "AnimatePresence"
Cohesion: 0.40
Nodes (5): AnimatePresence, Basic Usage, Custom Data, Mode Options, Props

### Community 107 - "Roteiro de apresentação do app"
Cohesion: 0.40
Nodes (4): Antes de cada apresentação, Dicas, O que mostrar, na ordem, Roteiro de apresentação do app

### Community 108 - "tipos.ts"
Cohesion: 0.12
Nodes (15): igual(), Linhas, migrarProgressao(), antigo(), L(), slot(), todas(), base (+7 more)

### Community 110 - "marca.test.ts"
Cohesion: 0.29
Nodes (5): arquivos(), chaves(), PROIBIDOS, semPix(), VARS

### Community 111 - "Navigation Menus"
Cohesion: 0.50
Nodes (4): Animated Dropdown Menu, Mega Menu, Mobile Hamburger Menu, Navigation Menus

### Community 112 - "List Animations"
Cohesion: 0.50
Nodes (4): Animated List with Add/Remove, List Animations, Reorderable List (Drag to Reorder), Staggered Grid

### Community 113 - "Shared Element Transitions"
Cohesion: 0.50
Nodes (4): Card Expansion with Shared Layout, Image Gallery with Shared Layout, Shared Element Transitions, Tab Indicator

### Community 114 - "Complex Gestures"
Cohesion: 0.50
Nodes (4): Complex Gestures, Long Press Gesture, Multi-Direction Swipe Handler, Pinch to Zoom

### Community 115 - "Form Animations"
Cohesion: 0.50
Nodes (4): Floating Label Input, Form Animations, Form Validation with Animation, Multi-Step Form with Progress

### Community 116 - "Variants"
Cohesion: 0.50
Nodes (4): Dynamic Variants, Variant Definition, Variant Propagation, Variants

### Community 117 - "Event Info Types"
Cohesion: 0.50
Nodes (4): Event Info Types, PanInfo (Drag events), Point, TapInfo

### Community 118 - "Layout Props"
Cohesion: 0.50
Nodes (4): layout, Layout Props, layoutDependency, layoutId

### Community 119 - "MesosDoAluno.tsx"
Cohesion: 0.15
Nodes (35): `src/features/aluno/` — App do aluno, dataSP(), proximoMeso(), hoje, mk(), mesoPadrao(), CartaoAgora(), CartaoMeso() (+27 more)

### Community 120 - "pdfRelatorio.ts"
Cohesion: 0.14
Nodes (17): 12/10/2026 — PDF real, correção não conta, modo coach, presencial em grupo, sem emoji, `src/features/relatorio/` — Relatório do fim do ciclo, C, criarFolhas(), disp(), LARG, M, MUDO (+9 more)

### Community 121 - "BotaoSinal.tsx"
Cohesion: 0.83
Nodes (3): relatarSinalFisio(), BotaoSinal(), relatar()

### Community 122 - "hojeSaoPaulo"
Cohesion: 0.12
Nodes (12): COACH, ALUNO, amanha(), COACH, DOBRAS, ALUNO, COACH, dia() (+4 more)

### Community 134 - "corpoPaths.ts"
Cohesion: 0.11
Nodes (22): ARTE, clarear(), COR_CORPO, ESTAVEL_PDF, LEGENDA, LEGENDA_FRACA, lista(), Parte (+14 more)

### Community 135 - "Aviso"
Cohesion: 0.13
Nodes (24): PerfilDemora(), pedir(), SemAcesso(), PagarPix(), copiar(), QrCadastro(), DuasEtapas(), erros (+16 more)

### Community 136 - "limpeza-lgpd.mjs"
Cohesion: 0.25
Nodes (5): auth, corte, db, projeto, PROJETOS

### Community 137 - "react"
Cohesion: 0.08
Nodes (71): `src/features/avaliacao/` — Avaliação física e relatório escrito de evolução (Fase 3; plano em `docs/plano-avaliacao.md`), firebase, react, AnamneseCoach(), Anotacao(), codigo(), falhou(), quando() (+63 more)

### Community 138 - "saude.yml"
Cohesion: 0.10
Nodes (19): ENDERECOS, GH_TOKEN, jobs, saude, name, on, schedule, workflow_dispatch (+11 more)

### Community 140 - "Revisão do PR #166 — carga por lado"
Cohesion: 0.40
Nodes (4): Correções necessárias (P2), Histórico econômico, Revisão do PR #166 — carga por lado, Validação

### Community 142 - "@playwright/test"
Cohesion: 0.08
Nodes (16): ALUNO, COACH, NOMES, ALUNO, COACH, ALUNO, COACH, ALUNO (+8 more)

### Community 143 - "12/11/2026 — orientação individual dos métodos"
Cohesion: 0.11
Nodes (16): 12/11/2026 (noite) — Claude: Etapa 3 e lista geral de perigo, 12/11/2026 — orientação individual dos métodos, 13/11/2026 (madrugada) — Claude: rodada 4 (pedido do Victor antes de dormir), 13/11/2026 (manhã) — Claude: correções da revisão do PR (F1–F8), Continuidade Físio — Codex / Claude, Critério de pronto e verificação, Critérios do Markdown científico, Decisões desta entrega (+8 more)

### Community 144 - "src/ia.ts"
Cohesion: 0.19
Nodes (14): appCheckOk(), ArmazemIA, atenderIA(), chaveIAValida(), erro(), EstadoIA, MAX_CORPO_IA, metadados() (+6 more)

### Community 145 - "inatividade.ts"
Cohesion: 0.29
Nodes (10): Armazem, AVISO_SAIU, cronometroRodando(), expirou(), lerUltima(), LIMITE_MIN, marcar(), treinoEmAndamento() (+2 more)

### Community 146 - "acoes.ts"
Cohesion: 0.10
Nodes (34): `fisioOrientacoes/{id automático}`, Onde mexer para…, LGPD, CardioHoje(), sairAgora(), sairAgora(), IcCardio, apagarAluno() (+26 more)

### Community 147 - "5. Catálogo por queixa (ordem: as que mais aparecem na rotina de academia)"
Cohesion: 0.12
Nodes (16): 1. Sua tarefa, 2. Regras de escopo (valem para o grupo inteiro), 3. Estrutura de dados sugerida para cada método, 4. Regras globais de progressão (aplicar a todos os métodos), 5.1 Coluna lombar — dor lombar crônica inespecífica, 5.2 Ombro — dor relacionada ao manguito rotador / subacromial, 5.3 Joelho, 5.4 Tendões (tendinopatias) (+8 more)

### Community 148 - "Árvore por pasta"
Cohesion: 0.06
Nodes (34): `anamneses/{id automático}`, `arquivados/{chave}`, `avaliacoes/{id automático}`, `cardios/{uid}_{AAAA-MM-DD}`, Coleções Firestore, Comandos e workflows, `exclusoes/{uid}`, `feedbacks/{id automático}` (+26 more)

### Community 149 - "limpeza"
Cohesion: 0.18
Nodes (11): group, PREFIXO, limpeza, concurrency, env, if, needs, runs-on (+3 more)

### Community 150 - "marca"
Cohesion: 0.20
Nodes (10): marca, default, description, options, type, on, schedule, workflow_dispatch (+2 more)

### Community 151 - "@playwright/test"
Cohesion: 0.12
Nodes (7): ALUNO, COACH, PNG, COACH, ALUNO, COACH, @playwright/test

### Community 152 - "env"
Cohesion: 0.25
Nodes (8): BACKUP_SENHA, EVENTO, GH_TOKEN, MARCA, NOVO, PROJETO, SA, env

### Community 153 - "Entrar.tsx"
Cohesion: 0.20
Nodes (16): Entrar(), enviar(), voltar(), mensagemErro(), cadastrar(), confirmarLoginTotp(), entrar(), resolverMfa() (+8 more)

### Community 154 - "steps"
Cohesion: 0.33
Nodes (7): steps, steps, id, if, name, run, uses

### Community 155 - "Avaliacao.tsx"
Cohesion: 0.14
Nodes (29): Avaliacao(), Chipe(), COR, GrupoCartao(), LinhaMedida(), SETA_VEREDITO, SetaIc(), corParte() (+21 more)

### Community 156 - "limpeza-lgpd.yml"
Cohesion: 0.33
Nodes (5): jobs, name, permissions, actions, contents

### Community 157 - "criarMeso"
Cohesion: 0.07
Nodes (25): ALUNO, COACH, ALUNO, meso(), prog, ALUNO, COACH, diasAtras() (+17 more)

### Community 158 - "with"
Cohesion: 0.40
Nodes (5): with, name, node-version, path, retention-days

### Community 160 - "preparar"
Cohesion: 0.40
Nodes (5): preparar, matriz, if, outputs, runs-on

### Community 162 - "firebase-admin"
Cohesion: 0.10
Nodes (14): firebase-admin@14.5.0, firebase-admin, atual, novo, aluno, b, db, { meso, registros } (+6 more)

### Community 163 - "feedback.spec.ts"
Cohesion: 0.40
Nodes (5): ANA, BIA, COACH, comoAluno(), entrar()

### Community 164 - "Físio — articulações e músculos de cada exercício (para o Victor conferir)"
Cohesion: 0.13
Nodes (14): Abdome e Lombar, Adutores e Abdutores, Antebraço, Bíceps, Dorsais, Escolhas que eu fiz (confira primeiro), Físio — articulações e músculos de cada exercício (para o Victor conferir), Ombros (+6 more)

### Community 165 - "aluno-exemplo.test.ts"
Cohesion: 0.22
Nodes (7): AGORA, COLECOES, db, FUTURO, plano(), SEMANA2, tudo()

### Community 167 - "Pesquisa — Delimitação de volume adequado, lesão e dor (o que a literatura diz)"
Cohesion: 0.13
Nodes (14): 0. Conclusão central (ler primeiro), 1. Como o volume é medido, 2. Faixas de volume da literatura (população saudável), 3.1 Epidemiologia na musculação, 3.2 Razão carga aguda:crônica (ACWR), 3.3 Aumento semana a semana ("regra dos 10%"), 3.4 Retorno após pausa, 3.5 Deload (+6 more)

### Community 168 - "norm"
Cohesion: 0.28
Nodes (8): CampoExercicio(), SeletorExercicios(), POR_NOME, buscarExercicios(), itens, norm(), nomes(), MAX_EXERCICIOS

### Community 172 - "InicioAluno.tsx"
Cohesion: 0.12
Nodes (40): Peças compartilhadas (já no código), Linha(), AnamnesePendente(), AvaliacaoPronta(), InicioAluno(), jaViuPopup(), marcarPopup(), Msg() (+32 more)

### Community 173 - "AlunoApp.tsx"
Cohesion: 0.08
Nodes (58): motion, AlunoApp(), Campo(), CHAVE_NOVIDADES, Chip(), Novidades(), novidadesNaoVistas(), passos() (+50 more)

### Community 174 - "Plano — Entrega 4: registro de erros e segurança"
Cohesion: 0.18
Nodes (10): 1. Registro de erros ("Erros do app"), 2. Verificação em 2 etapas (MFA) — só para o coach, 3. Tentativas de login, 4. Desconectar por falta de uso, 5. Varredura de injeção (o "SQL injection" daqui), 6. Pendências da revisão da Entrega 3, 7. Aviso de vencimento, 8. Passos do Victor no console (eu guio um por um) (+2 more)

### Community 175 - "notasMetodo.ts"
Cohesion: 0.36
Nodes (5): ANTIGA(), dispensarNota(), mostrarNotasDeNovo(), notaDispensada(), SEQUENCIA

### Community 176 - "vite.config.ts"
Cohesion: 0.15
Nodes (10): @tailwindcss/vite@^4.3.3, vite@^8.3.4, @vitejs/plugin-react@^6.1.1, @tailwindcss/vite, vite, @vitejs/plugin-react, arquivos(), previewHeaders (+2 more)

### Community 180 - "Botao"
Cohesion: 0.14
Nodes (24): Acoes(), Alertas(), CartaoAbaixo(), Grupo(), Saindo(), FormularioData(), Aba, ABAS (+16 more)

### Community 181 - "Força — app de treino (substitui a planilha "Força 2027.1")"
Cohesion: 0.04
Nodes (44): Comandos, Economia de tokens — regra de delegação, Força — app de treino (substitui a planilha "Força 2027.1"), graphify, Hierarquia dos agentes (definida pelo Victor em 14/10/2026), Onde está cada coisa, Plugins (ativados em `.claude/settings.json`), PRs: fluxo automático (autorizado pelo Victor em 07/10/2026) (+36 more)

### Community 184 - "erros.mjs"
Cohesion: 0.25
Nodes (5): corte, db, linhas, projeto, PROJETOS

### Community 188 - "src/index.ts"
Cohesion: 0.17
Nodes (12): CacheAcesso, cors(), ORIGENS, AcaoIA, ROTAS_IA, DESCANSO, DO_ALUNO, Env (+4 more)

### Community 200 - "pwa-assets.config.ts"
Cohesion: 0.50
Nodes (3): @vite-pwa/assets-generator@^1.0.4, fundo, @vite-pwa/assets-generator

## Knowledge Gaps
- **4 isolated node(s):** `RFC-8188`, `RFC-8292`, `RFC-8291`, `RFC-8291`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1421 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `avaliacao.ts`, `FisioCoach.tsx`, `ataques.test.ts`, `corpoPaths.ts`, `planilha.ts`, `engine/index.ts`, `react`, `Aviso`, `acoes.ts`, `log.ts`, `EditarTreino.tsx`, `util.ts`, `cartaoRelatorio.ts`, `src/ia.ts`, ``src/lib/` — Firestore, estado, cálculos com dados`, `acoes.ts`, `inatividade.ts`, `Alertas.tsx`, `lados.ts`, `FimTreino.tsx`, `jwt.ts`, `Entrar.tsx`, `cartaoStory.ts`, `iaTreino.ts`, `cartaoDepoimento.ts`, `webpush.ts`, `aluno-exemplo.test.ts`, `ref_node_fs`, `firebase-admin`, `norm`, `Treino.tsx`, `src/index.ts`, `avisos-pagamento.mjs`, ``src/lib/` — Firestore, estado, cálculos com dados`, `notasMetodo.ts`, `segmentos.ts`, `src/acesso.ts`, `fmtMin`, `conversores.test.ts`, `sugestoesFisio.ts`, `ContaAluno.tsx`, `seriesDoRotulo`, `src/index.ts`, `acoesFisio.ts`, `SessaoCard.tsx`, `ui.tsx`, `cadastro.ts`, `EnviarFeedback.tsx`, `dor.ts`, `package.json`, `GuiaFisio.tsx`, `engine/index.ts`, `mfa.ts`, `Onde fica cada coisa`, `PagarPix.tsx`, `rules.test.ts`, `atualizar.ts`, `progressaoFisio.ts`, `descanso.ts`, `tipos.ts`, `marca.test.ts`, `MesosDoAluno.tsx`, `pdfRelatorio.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Are the 158 inferred relationships involving `Pontos sensíveis (leia antes de auditar ou mexer)` (e.g. with `dados()` and `nadaPassaDaTela()`) actually correct?**
  _`Pontos sensíveis (leia antes de auditar ou mexer)` has 158 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8188`, `RFC-8292`, `RFC-8291` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `avaliacao.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08907563025210084 - nodes in this community are weakly interconnected._
- **Why does `Pontos sensíveis (leia antes de auditar ou mexer)` connect `conversores.test.ts` to `avaliacao.ts`, `FisioCoach.tsx`, `Aviso`, `Hoje.tsx`, `engine/index.ts`, `react`, `acoes.ts`, `EditarTreino.tsx`, `util.ts`, `src/ia.ts`, `inatividade.ts`, `acoes.ts`, `Árvore por pasta`, `Alertas.tsx`, `Presencial.tsx`, `lados.ts`, `FimTreino.tsx`, `Entrar.tsx`, `vitest`, `Avaliacao.tsx`, `cartaoStory.ts`, `iaTreino.ts`, `Alunos.tsx`, `Treino.tsx`, `src/index.ts`, `InicioAluno.tsx`, `AlunoApp.tsx`, `avisos-pagamento.mjs`, ``src/lib/` — Firestore, estado, cálculos com dados`, `segmentos.ts`, `src/acesso.ts`, `Botao`, `ContaAluno.tsx`, `seriesDoRotulo`, `SessaoCard.tsx`, `ui.tsx`, `ImportarPlanilha.tsx`, `Descanso`, `engine/index.ts`, `App.tsx`, `Onde fica cada coisa`, `PagarPix.tsx`, `MesosDoAluno.tsx`, `pdfRelatorio.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Botao()` (e.g. with `Pontos sensíveis (leia antes de auditar ou mexer)` and ``src/` — Raiz`) actually correct?**
  _`Botao()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `FisioCoach.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11250873515024458 - nodes in this community are weakly interconnected._