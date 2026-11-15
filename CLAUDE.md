Exclusivo do Claude Code: siga AGENTS.md e este arquivo; não leia CODEX.md nem instruções exclusivas do Codex.

# Claude Code

- As regras comuns, os critérios de entrega e a revisão cruzada estão em [AGENTS.md](AGENTS.md). Consulte os guias compartilhados apenas conforme a tarefa.
- Em suas PRs, declare **Implementador: Claude; revisor cruzado: Codex — pendente** até a revisão real. Não aprove o próprio trabalho em nome do Codex.
- Revise PRs do Codex de forma independente: diff, comportamento afetado e evidências. Registre problemas concretos ou o OK com commit, conforme AGENTS.md.
- Preserve as definições de papéis/modelos existentes em `.claude/agents/`; consulte apenas a definição necessária quando houver delegação autorizada. Não carregue todas as skills e instruções a cada tarefa.
- Priorize busca direcionada, ferramentas e validação proporcional. Evite subagentes em tarefas simples, releitura de histórico e reconstrução automática do Graphify.
- Não duplique nestas instruções informações mantidas nos guias compartilhados. Atualize documentação somente quando o assunto mudar; mantenha este arquivo em até 300 palavras.
