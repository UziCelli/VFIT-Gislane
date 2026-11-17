Instruções comuns: Codex lê CODEX.md; Claude Code lê CLAUDE.md; cada agente ignora o guia exclusivo do outro.

# Trabalho no Força

## Começar com pouco contexto

- Leia apenas este arquivo e o guia do seu agente: [Codex](CODEX.md) ou [Claude](CLAUDE.md). Não siga referências antigas que mandem ler o guia do outro.
- Consulte [índice](docs/README.md) e [pendências](docs/estado-sessao.md) somente se a tarefa precisar. Histórico, pesquisas e planos não são leitura inicial obrigatória.
- Busque só arquivos/trechos relacionados à tarefa. Graphify existente pode localizar relações: `graphify query "símbolo ou tema específico" --budget 1000 --depth 1`. Confirme no código; se desatualizado ou pouco útil, use `rg`. Não leia o grafo/relatório inteiro nem regenere por rotina de revisão.
- Antes de alterar uma área, busque seu nome em [Pontos sensíveis](docs/mapa.md#pontos-sensíveis-leia-antes-de-auditar-ou-mexer); leia apenas as linhas pertinentes. Para dados, autenticação, backend ou infraestrutura, consulte [segurança](SECURITY.md).
- Para implementar, consulte [estilo](CODE_STYLE.md); para mudanças estruturais, [arquitetura](ARCHITETURE.md).

## Entrega e revisão

- O dono não programa: explique em português simples, curto, com resultado e limitações.
- Preserve trabalho paralelo; use branch própria baseada na main atual. Não sobrescreva alterações alheias.
- Cada PR identifica implementador, revisor cruzado, documentação afetada e validação, conforme [modelo](.github/pull_request_template.md).
- Claude revisa PR do Codex; Codex revisa PR do Claude. Antes do merge, registrar **“Revisão cruzada: OK”**, com o commit revisado, pelo outro agente; nova alteração exige revisão do novo diff. Exceção somente com autorização explícita do dono para aquela entrega.
- Só juntar com revisão válida, verificações obrigatórias verdes e autorização de integração aplicável. Não publicar PR de trabalho; depois de merge autorizado, conferir os workflows de publicação. Não contornar proteção nem considerar teste pulado como aprovação.

## Passo a passo da entrega (use como lista, sem reler o resto)

1. **Antes de rodar o CI:** `git fetch origin main`. Se a main andou, junte-a na branch (merge, sem rebase) e resolva conflito. Confira se o Graphify versionado mudou: `git diff --stat origin/main HEAD -- graphify-out`. Vazio = nada a fazer. Mudou por causa da main = aceite a versão da main; nunca regenere o grafo por rotina. O arquivo `graphify-out/cache/last_query_stamp` muda sozinho a cada `graphify query`: descarte com `git checkout -- graphify-out/cache/last_query_stamp`, não commite.
2. **Rascunho + revisão cruzada:** com a PR em rascunho, comente `@codex review` (se o autor for o Codex, o Claude revisa). Espere o parecer; ajuste o que for concreto e peça nova revisão do novo commit.
3. **Revisão OK:** só com **“Revisão cruzada: OK”** e o commit revisado registrados. Então tire do rascunho: isso dispara uma única rodada completa de CI.
4. **CI verde no commit atual** (reexecute só o job instável, uma vez; nunca pule teste).
5. **Merge** só com 3 e 4 cumpridos e a autorização do dono para integrar. Depois, conferir os workflows de publicação.

## Economia sem perder proteção

- Faça validação proporcional: testes afetados, ampliando por risco ou falha; não repita testes aprovados sem mudança relevante. Preserve o CI obrigatório. PR em rascunho adia o CI pesado existente até ficar pronta.
- **Minutos do Actions são limitados (repositório privado, plano grátis, vários repositórios do dono). Não rode teste à toa.** Durante o trabalho: nenhum teste, ou só o do arquivo afetado quando indispensável. Nunca e2e nem regras com emuladores por rotina. A PR fica em rascunho até a revisão cruzada (`@codex review` em comentário) terminar e não haver ajuste pendente; só então sai do rascunho, para uma única rodada completa de CI. Falha de instabilidade: reexecute só o job que falhou. Não reexecute verificação verde sem mudança. Mudança só de documentação não pede teste. Publicação só no merge.
- Sem delegação automática para tarefas simples. Use ferramentas determinísticas para operações simples; não prometa economia exata ou troca de modelo indisponível.
- Atualize documentação só quando comportamento, regra ou pendência mudar. Uma fonte por assunto; links nos demais lugares. Não acumule diário de entregas no contexto inicial.
