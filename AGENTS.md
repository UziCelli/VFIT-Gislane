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

## Economia sem perder proteção

- Faça validação proporcional: testes afetados, ampliando por risco ou falha; não repita testes aprovados sem mudança relevante. Preserve o CI obrigatório. PR em rascunho adia o CI pesado existente até ficar pronta.
- Sem delegação automática para tarefas simples. Use ferramentas determinísticas para operações simples; não prometa economia exata ou troca de modelo indisponível.
- Atualize documentação só quando comportamento, regra ou pendência mudar. Uma fonte por assunto; links nos demais lugares. Não acumule diário de entregas no contexto inicial.
