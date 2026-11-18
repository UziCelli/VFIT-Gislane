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
3. **Revisão OK no commit atual** (o que vale como OK está no [Fluxo automático](#fluxo-automático-de-pr-victor-17112026)). Então tire do rascunho: isso dispara uma única rodada completa de CI.
4. **CI verde no commit atual** (reexecute só o job instável, uma vez; nunca pule teste).
5. **Merge** com 3 e 4 cumpridos, feito pelo Claude sem perguntar (exceções: dados em produção ou custo em dinheiro). Depois, conferir os workflows de publicação.

## Fluxo automático de PR (Victor, 17/11/2026)

Do PR ao merge sem esperar o Victor, com o mínimo de Actions e de uso das IAs.

- **Todo PR abre em rascunho.** Rascunho não roda CI. Sai do rascunho só com a revisão cruzada OK no commit atual, para uma única rodada completa de CI.
- **PR do Claude:** comentar `@codex review`. Vale como OK do Codex o resumo "Codex Review" concluído no commit atual sem achados pendentes, ou um comentário "Revisão cruzada: OK" do Codex. Achado real: corrigir, enviar e pedir `@codex review` de novo. Achado que não procede: responder na conversa com o motivo.
- **PR do Codex (branch `codex/…`):** o Codex abre o PR só com o trabalho terminado e não envia commits depois (mudança pedida depois vira PR novo). Não precisa avisar ninguém: uma tarefa do Claude com gatilho do GitHub é acionada sozinha e revisa. Se achar problema, o Claude corrige no próprio PR e pede `@codex review` para o Codex conferir a correção. Com tudo OK, o Claude registra "Revisão cruzada: OK" com o commit.
- **Dependabot (branch `dependabot/…`):** atualizações pequenas chegam juntas uma vez por mês; o workflow `dependabot-juntar.yml` junta sozinho, sem IA, quando toda atualização é pequena (minor/patch) e toda verificação do commit (check-runs e commit statuses) terminou com sucesso, sem contar pulada como aprovação; sem revisão do Codex. O tamanho vem do `update-type`; sem ele (correção de segurança do npm, `requirement` do pip), vem do título "de A para B" de um PR de 1 commit e 1 dependência, só se a versão grande (major) não mudou (em 0.x, também o número do meio). Versão grande, sem número (SHA) ou que não dá para classificar: não junta; o Claude comenta o risco no PR e avisa o Victor.
- **Juntar sem perguntar:** o merge fica com o Claude. Com revisão cruzada OK no commit atual, nenhum achado pendente e CI obrigatório verde, ele tira do rascunho se preciso, junta conferindo o commit e acompanha a publicação. Perguntar ao Victor antes só se a mudança apagar ou migrar dados que já estão em produção, ou tiver custo em dinheiro.
- **CI vermelho:** corrigir e repetir; mudança de código depois do OK pede novo `@codex review`. Falha que não é do PR: explicar ao Victor em linguagem simples. Instabilidade: reexecutar só o job que falhou, uma vez.
- **Esperar não gasta IA:** a revisão do Codex e o CI são acompanhados por consulta à API do GitHub em segundo plano, sem rotina agendada nem conversa de verificação.
- **No fim:** avisar o Victor em 2–3 tópicos (o que mudou e se já está no ar).

## Economia sem perder proteção

- Faça validação proporcional: testes afetados, ampliando por risco ou falha; não repita testes aprovados sem mudança relevante. Preserve o CI obrigatório. PR em rascunho adia o CI pesado existente até ficar pronta.
- **Minutos do Actions são limitados (repositório privado, plano grátis, vários repositórios do dono). Não rode teste à toa.** Durante o trabalho: nenhum teste, ou só o do arquivo afetado quando indispensável. Nunca e2e nem regras com emuladores por rotina. Rascunho e revisão antes do CI: ver [Fluxo automático de PR](#fluxo-automático-de-pr-victor-17112026). Falha de instabilidade: reexecute só o job que falhou. Não reexecute verificação verde sem mudança. Mudança só de documentação não pede teste. Publicação só no merge.
- Sem delegação automática para tarefas simples. Use ferramentas determinísticas para operações simples; não prometa economia exata ou troca de modelo indisponível.
- Atualize documentação só quando comportamento, regra ou pendência mudar. Uma fonte por assunto; links nos demais lugares. Não acumule diário de entregas no contexto inicial.
