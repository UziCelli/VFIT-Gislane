# Passagem de bastão — Divisão: arrastar ordem, excluir qualquer exercício, voz desligada (14/11/2026)

Pedido do Victor:
1. Na aba **Divisão** do meso, mudar a ordem dos exercícios **arrastando** (o número da posição se ajusta sozinho).
2. **Excluir qualquer exercício** (antes só dava para excluir o último).
3. **Tirar a montagem do meso por voz** por enquanto (gasta a chave da API e ainda interpreta errado).

Branch: `claude/eloquent-lovelace-4b0eu2` (a partir da `main` em `e7961f3`).

## O que já está FEITO (e testado)

### Lógica (`src/features/coach/meso/util.ts`)
- `moverExercicio(meso, t, de, para)` — leva o exercício da posição `de` para `para` no treino `t`.
- `removerExercicio(meso, t, p)` — tira o exercício de qualquer posição; os de baixo sobem.
- Os dois usam `reposicionar(...)`, que remapeia o que guarda **posição**:
  - `meso.metodos[].exercicio` (métodos vão junto com o exercício);
  - `meso.trocas` (chave `semana-treino-pos`);
  - posições de exercícios adicionados (depois da divisão) sobem ao excluir;
  - grupo (Biset/Triset/Superset/Circuito) que fica incompleto ao excluir sai inteiro (`totalCerto`).
- Cargas e progressão própria ficam no `slotId` → **nada se perde**.
- Testes: `util.test.ts` (bloco "moverExercicio / removerExercicio").

### Motor (`src/engine/sessao.ts`, TDD)
- `prescreverSessao`: sessão editada no presencial (`meso.sessoes`, que o editor não grava) guarda a posição `de` de quando foi editada. Agora acha o exercício pelo `slotId` onde ele está hoje (divisão ou troca da semana). Slot trocado na hora (slotId novo) continua seguindo o `de` gravado.
- Teste novo em `sessao.test.ts` ("sessão editada segue o exercício pelo slotId…").

### Tela (`src/features/coach/meso/TabDivisao.tsx`)
- Alça **⠿** em cada exercício: arrastar com dedo/mouse (pointer events, sem biblioteca; `motion` não serve porque o `LazyMotion` está em `strict`).
  - O item segue o dedo, os outros abrem espaço; ao soltar chama `moverExercicio`.
  - Rolagem automática perto da borda de cima (<100px) e de baixo (<130px, por causa da barra de abas).
  - Teclado: setas ↑/↓ na alça movem uma casa.
- Botão **"Excluir"** em todos os exercícios (linha do "2 lados"). Apagar o texto do campo também exclui. Pede confirmação só se já houver carga.
- `li` agora usa `key = slotId`.

### Voz desligada
- `EditorMeso.tsx`: removido `<VozTreino>`. `MinhaConta.tsx`: removido `<AssistenteIA>` (tela da chave).
- Código guardado (`VozTreino.tsx`, `AssistenteIA.tsx`, `lib/ia.ts`, `lib/voz.ts`, `lib/iaTreino.ts`) para religar depois.
- `e2e/voz-ia.spec.ts`: `test.skip(true, …)` com o motivo e como religar.

### Testes e docs
- e2e novo: `e2e/ordem.spec.ts` (arrasta 3→1, seta ↓, exclui do meio, salva e confere no Firestore que a ordem e o método foram junto).
- `docs/mapa.md`: linha nova em "Pontos sensíveis" + notas de voz desligada e da alça na `TabDivisao`.
- `docs/estado-sessao.md`: entrada de 14/11/2026.
- Grafo atualizado (`graphify update .`).

### Checagens que passaram
- `npm run typecheck` ✅
- `npm test` ✅ (1.120 testes)
- `npm run build` e `vite build --mode gislane` ✅
- e2e: `ordem`, `coach`, `adicoes`, `metodos`, `presencial`, `importar`, `layout` ✅ (rodar com `PW_CHROMIUM=/opt/pw-browsers/chromium` e `--trace off` na nuvem do Claude).

## O que FALTA fazer
1. **Revisão do diff** (papel do `revisor`) — não foi feita. Pontos para olhar:
   - `reposicionar` em `util.ts` (remapeio de métodos/trocas/grupos);
   - arrasto em `TabDivisao.tsx` (pointer capture, rolagem automática com `requestAnimationFrame`).
2. **Teste no celular de verdade** (Android e iPhone): arrastar com o dedo, rolagem automática numa lista de 8–10 exercícios, e se o campo do nome ficou largo o bastante em 360px.
3. Abrir o PR (rascunho → pronto), esperar CI verde e a **revisão cruzada** ("Revisão cruzada: OK") antes de juntar.
4. Depois de juntar: conferir os jobs `deploy` e `gislane` do "Publicar" e avisar o Victor.

## Limites conhecidos (aceitos, documentados no mapa)
- A pausa dos principais (posições 1–2) acompanha a **posição**, não o exercício: quem vai para a posição 1 ganha a pausa dos principais (se não tiver pausa própria).
- Sessão editada no presencial cujo exercício foi **trocado na hora** segue a progressão de quem estiver hoje na posição `de`.
- Não há rolagem automática enquanto o dedo fica parado fora da borda (só perto das bordas).
