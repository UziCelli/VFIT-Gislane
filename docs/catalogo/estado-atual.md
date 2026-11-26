# Estado do projeto: Catálogo de exercícios

Atualizado em 26/11/2026 (fim da tarde, BRT). Este arquivo é a passagem de bastão entre o Claude e o Codex. Leia antes de mexer na PR #251.

- **Repo:** UziCelli/VFIT-Gislane.
- **Celli:** escreve em português simples e curto, tem TDAH e não programa. Responda com o resultado primeiro.
- **Fluxo:** issue → PR rascunho → `@codex review` → CI verde → squash merge.
- **Trava da #251:** fica aberta e em **rascunho**. Nada de ready, auto-merge, merge, deploy, migração ou dados reais sem o Celli.

## Plano

- Épico **#255**, com as sub-issues #256 a #263.
- Decisão do Celli: **nada de PR única**.
  - A **#251** cobre as etapas 1 a 4.
  - As etapas 5 a 8 vão em PRs novas: 5 máquinas (#260), 6 série grava a máquina (#261), 7 carga por máquina (#262), 8 conector MCP (#263).
- A **#252** (vídeos) já foi juntada.

## PR #251: etapas 1 a 4 feitas

1. **Inventário** dos 359 exercícios atuais, em [inventario.md](inventario.md) e `inventario-atual.csv`. Gerador: `tools/catalogo-inventario.py --atributos`.
   - Resultado: 216 iguais, 141 renomeados e 2 excluídos.
   - **Nenhum exercício está "a confirmar".** O Celli respondeu os 13 em 26/11; as respostas estão em inventario.md.
2. **Atributos como fonte da verdade:** `src/data/atributos.json` e `src/data/catalogo.ts`.
   - O nome que aparece é gerado a partir dos atributos.
   - O nome antigo e os apelidos continuam resolvendo para o mesmo id, e o histórico (carga, RM, Físio, notas e vídeos) continua ligado.
   - Os **excluídos** (`oculto`) saem da busca, do catálogo, da lista da IA e da lista de vídeos, mas o histórico continua.
3. **Pílulas com ícones** (`src/lib/pilulas.ts`, `src/features/catalogo/PilulasExercicio.tsx`). Aparecem no treino do aluno, na busca do coach e no card da sessão.
4. **Cadastro manual:** Guias → Catálogo de exercícios → Adicionar exercício. Código em `src/features/catalogo/Catalogo.tsx` e `src/lib/catalogoProprio.ts`.
   - Mostra a prévia do nome.
   - Bloqueia duplicata, inclusive de nomes que geram o mesmo id.
   - Marca o exercício com o selo "Seu".
   - Firestore: `exerciciosProprios`, que só o coach com 2º fator acessa.
   - Exercício cadastrado com **"Por lado"** já entra no treino com `doisLados: true` gravado no slot, porque o aluno não lê o cadastro.

### Provas (HEAD da #251)

- `npx tsc --noEmit` ok.
- `npx vitest run`: 1534 ok.
- Regras no emulador: 421 ok.
- **E2E `e2e/catalogo.spec.ts`** (390 × 844, dados sintéticos no emulador) passou. Ele cobre:
  - Guias → Catálogo, com busca pelo nome antigo e filtros.
  - Cadastro com prévia.
  - Bloqueio de duplicata (pontuação e catálogo base).
  - Busca na montagem com o selo "Seu", salvar e reabrir, com `doisLados` gravado.
  - O aluno vê "kg de cada lado".
- Comando usado:
  ```
  PW_CHROMIUM=/opt/pw-browsers/chromium PRINT_CATALOGO=<pasta> npx firebase emulators:exec --only auth,firestore --project demo-forca 'npx playwright test e2e/catalogo.spec.ts --trace off'
  ```
- Capturas em [capturas/](capturas/).

### Lacunas conhecidas (não feitas nesta PR)

- **Aluno não vê as pílulas do exercício cadastrado.** Os atributos estão em `exerciciosProprios`, que é privado do coach.
  - Caminho seguro: gravar no slot um resumo mínimo (equipamento, lados, modo) ao escolher o exercício, validado nas regras.
  - Assim o aluno não ganha leitura do catálogo privado.
- **Edição presencial** (`src/features/coach/presencial/EditarTreino.tsx`): trocar ou adicionar um exercício cadastrado ali **não** grava `doisLados`. A montagem do meso grava.
- **Isométrico cadastrado:** não existe ainda, porque o cronômetro só reconhece os isométricos do catálogo base.
- **Conector (IA):** ainda oferece os nomes atuais e não conhece os cadastrados. Isso fica para a etapa 8 (#263).
- **Lista dos novos:** a "Remada Cavalinho (T-Bar Row) Pegada Aberta" está como **barra**, mas o Celli disse que T-Bar Row é a **articulada**. É preciso revisar ao importar a lista.
- **Sem resposta ainda:** cinto de carga e bola de adução viram equipamentos próprios?

## Regras de nomes decididas pelo Celli

- **Halteres e Halter**
  - Carga por lado = **Halteres**. Vale para supino, afundo, avanço, recuo e búlgaro.
  - **1 halter:** Agachamento Livre, Pullover, Tríceps Francês e Rosca Scott "Halter". A versão com 2 halteres é um exercício à parte.
- **Máquinas**
  - Puxadas e remadas sem equipamento no nome são **Seletora**, não Polia. "Máquina" sozinha também é Seletora.
  - O rótulo é **Articulada**.
  - Smith ≠ Smith Dual.
- **Exercícios que parecem iguais, mas são diferentes**
  - Box Jump ≠ Box Jumps.
  - Pulldown ≠ Pullover. Crossover ≠ Crucifixo. Stiff ≠ Terra Romeno.
- **Remadas**
  - Remada Curvada Fechada, Pronada e Supinada = **Barra**. As versões com halteres são à parte.
  - Remada Cavalinho = **Barra**. **T-Bar Row = versão Articulada.**
- **Outros nomes**
  - Recuo, não Retrocesso. Farmer Walk fica em inglês. Burrinho. Caneleira. Miniband = Elástico. Kettlebell e Kettlebells.
  - O grupo Mobilidade vira **Alongamentos Estáticos** e **Alongamentos Dinâmicos**.

## Próximo passo (para o Codex)

1. Revise o HEAD da #251 como revisor cruzado. Confira o diff e rode `vitest`, as regras e `e2e/catalogo.spec.ts`.
2. Se estiver ok, registre "Revisão cruzada: OK" com o SHA. Só depois disso o Celli decide sobre CI e merge.
3. **Não** puxe as máquinas por unidade nem o motor de carga para a #251. Isso vai em PRs novas, a partir de #260.
