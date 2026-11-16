# Tela de propostas — rascunho para o Claude

Status: ideia inicial, sem implementação. Pedido do Victor em 16/11/2026. Branch: `docs/rascunho-tela-propostas`. Não abrir PR nesta etapa.

## Objetivo e responsabilidades

Hoje o coach acessa a proposta de treino da IA pelo link recebido no chat. Permitir encontrar e abrir essas propostas dentro do aplicativo, mantendo a conferência e a confirmação explícita.

Claude ficará responsável pela implementação futura. Após este rascunho documental, o Codex fica exclusivamente responsável pela revisão dos próximos PRs, em todos os ambientes e repositórios, conforme orientação do Victor. Este documento registra a orientação; não configura monitoramento automático nem altera outros repositórios. Revisão não implica autorização para merge ou publicação.

## Base existente verificada na main

- `src/App.tsx`: rota `/confirmar-treino-mcp?id=...`.
- `src/features/conta/ConfirmarTreinoMcp.tsx`: consulta e confirmação autenticadas; estados `proposta`, `salva`, `expirada`, `recusada` e `resultado_pendente`.
- `src/features/conta/PreviaTreinoMcp.tsx`: apresentação dos detalhes do treino.
- `conector/src/proposta.ts`: Durable Object por proposta, vinculado ao UID do coach, validade de 15 minutos e confirmação serializada.
- Contrato de referência: [conector-prescricao.md](conector-prescricao.md). Conferir a versão atual antes de implementar.

## Hierarquia da experiência sugerida

1. Navegação do coach → **Propostas de treino** (posição exata a definir).
2. Lista → aluno, nome do treino, tipo de ação, estado e prazo, quando disponíveis.
3. Abrir proposta → aproveitar a conferência existente, incluindo semanas, alterações, avisos e sessões preservadas.
4. Confirmar → usar o fluxo existente de salvar; atualizar a lista com o resultado real.

Prever carregamento, lista vazia, erro com nova tentativa, sessão vencida e proposta indisponível. Manter o acesso por link. Abrir ou listar nunca salva um treino.

## Ordem de criação e documentos

1. **Levantamento:** Claude verifica navegação, criação, armazenamento e expiração; identifica como localizar propostas por coach. Não presumir que o armazenamento atual oferece listagem.
2. **Contrato:** definir consulta/listagem autenticada, campos mínimos, ordenação, paginação, retenção e sincronização com os estados existentes. Caso necessário, propor índice por coach e tratar falhas entre criação e indexação. Validar isolamento por conta e projeto/marca.
3. **Interface:** definir entrada na navegação e lista; reutilizar detalhe e confirmação, evitando regras duplicadas.
4. **Validação:** testar acesso sem link, isolamento entre coaches, expiração, concorrência, atualização após salvar e regressão do link. Em resultado pendente, consultar o resultado sem criar nova proposta.
5. **Documentação final:** consolidar o contrato no documento existente, atualizar índice/mapa quando aplicável e substituir este rascunho pela referência definitiva.

## Decisões abertas

Definir com base no código: lista geral ou por aluno; somente pendentes ou histórico; disponibilidade por marca. Não incluir edição de proposta, cancelamento, notificações ou mudança de validade sem definir escopo.

Esta entrega contém apenas documentação em branch separada. Sem código, migração, deploy, merge ou PR.
