# Instruções para o Codex (e outros agentes)

As regras do projeto estão em `CLAUDE.md` e valem igual para você. Ignore só a parte de hierarquia de agentes/modelos (é do Claude Code).

- Comece por `docs/estado-sessao.md` (o que está em andamento) e `docs/mapa.md` (onde está cada coisa; leia "Pontos sensíveis" antes de mexer).
- Trabalho em andamento: `docs/plano-lados-isometria.md`, seção "Para o Codex continuar".
- Comandos: `npm run typecheck` · `npm test` · `npm run build` · `npm run test:rules` (emulador).
- O dono do projeto não programa: explique em português simples, curto e em tópicos.
- **Revisão cruzada (Victor, 13/11/2026):** você revisa todo PR do Claude e o Claude revisa todo PR seu. Nenhum PR é juntado sem o OK do outro. Detalhes em `CLAUDE.md`, seção "Revisão cruzada Claude ↔ Codex".

## Hierarquia do Codex (Victor, 14/11/2026)

- **Sol 6.1:** consultor, planejamento, arquitetura e revisão.
- **Terra 6.1:** desenvolvimento e execução das alterações.
- **Luna**, ou o modelo disponível mais barato: tarefas operacionais simples, como CI, commit, push e merge.
- **Astra:** advisor para questões excepcionalmente complexas ou problemas resistentes, somente quando necessário.
- A revisão cruzada Claude ↔ Codex acima continua obrigatória antes do merge. Esta hierarquia vale para o Codex; não altera `CLAUDE.md`.
