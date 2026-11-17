Exclusivo do Claude Code: siga AGENTS.md e este arquivo; não leia CODEX.md nem instruções exclusivas do Codex.

# Claude Code

- As regras comuns, os critérios de entrega e a revisão cruzada estão em [AGENTS.md](AGENTS.md). Consulte os guias compartilhados apenas conforme a tarefa.
- Em suas PRs, declare **Implementador: Claude; revisor cruzado: Codex — pendente** até a revisão real. Não aprove o próprio trabalho em nome do Codex.
- Revise PRs do Codex de forma independente: diff, comportamento afetado e evidências. Registre problemas concretos ou o OK com commit, conforme AGENTS.md.
- **Esperar sem gastar IA:** depois de `@codex review`, rode em segundo plano `.claude/esperar-pr.sh codex <PR>`; depois de tirar do rascunho, `.claude/esperar-pr.sh ci <PR>`. O script termina sozinho com o resultado, e só então a sessão volta a trabalhar.
- **Sessão da tarefa do GitHub (PR do Codex ou do Dependabot):** aja só em PR aberto de branch `codex/` ou `dependabot/` sem "Revisão cruzada: OK" no commit atual; senão, encerre sem fazer nada. Trabalhe na branch do próprio PR, não abra PR novo e termine com o resumo de 2–3 tópicos (é o que chega ao Victor).
- Tirar do rascunho: `gh api -X POST repos/<dono>/<repo>/pulls/<n>/ccr/ready_for_review`. Juntar: `merge_pull_request` com `expectedHeadSha`.
- Preserve as definições de papéis/modelos existentes em `.claude/agents/`; consulte apenas a definição necessária quando houver delegação autorizada. Não carregue todas as skills e instruções a cada tarefa.
- Priorize busca direcionada, ferramentas e validação proporcional. Evite subagentes em tarefas simples, releitura de histórico e reconstrução automática do Graphify.
- Não duplique nestas instruções informações mantidas nos guias compartilhados. Atualize documentação somente quando o assunto mudar; mantenha este arquivo em até 300 palavras.
