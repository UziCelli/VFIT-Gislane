# Conector MCP — continuação em rascunho

Este documento registra a revisão do rascunho #188. Não está pronto para produção ou integração.
A publicação automática do conector foi removida deste rascunho enquanto os pontos abaixo são resolvidos.

## Pontos que bloqueiam a entrega

- O pedido OAuth usa leitura e exclusão separadas no KV, que é eventualmente consistente: acessos simultâneos podem consumi-lo mais de uma vez. A autorização precisa de consumo atômico e teste de concorrência.
- O código cria um Worker separado. O pedido mais recente do Victor é aproveitar o backend existente e sua hospedagem, sem custo adicional. Integrar ao Worker existente requer verificar limites compartilhados, roteamento, deploy e falhas, sem prejudicar notificações.
- O escopo atual cobre apenas leitura, e apenas a marca VFIT. Criar e ajustar treinos continuam pendentes e devem preservar as cargas e a revisão do coach.
- A compatibilidade real com clientes MCP, o fluxo OAuth, a revogação, os limites de uso e o isolamento entre contas precisam de testes antes de disponibilizar dados de alunos.
- O plano usa KV e serviços Cloudflare e Firebase sujeitos a cotas; custo zero depende das cotas e das configurações das contas. Não há garantia de custo zero para qualquer volume.

O código herdado deve ser tratado como protótipo, não como implementação validada. Não conectar contas reais nem publicar até resolver os pontos acima e concluir revisão cruzada e testes.
