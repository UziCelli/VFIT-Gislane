# Conector MCP — revisão e continuação

Este PR ainda é um rascunho e não deve ser integrado nem publicado.

## Alterações realizadas

- O conector usa o Worker separado `vfit-conector`, criado pelo Victor. O Worker `vfit-descanso` continua responsável pelas notificações.
- O KV `vfit-mcp-oauth` foi vinculado na configuração usando o namespace informado pelo Victor. Os limites gratuitos são compartilhados pela conta Cloudflare.
- Cada pedido OAuth usa um Durable Object próprio do conector. Seu consumo é transacional para impedir duas aprovações simultâneas. A verificação do token renovado exige o mesmo usuário e projeto.
- A tela informa que esta entrega só faz leitura. A criação e o ajuste de treinos ficam para entrega posterior, como rascunho revisado pelo coach, sem alterar cargas dos alunos.

## Antes de ligar

- Preparar e validar o processo de publicação independente, incluindo a variável `FIREBASE_API_KEY` com a chave web pública do Firebase. O workflow de deploy automático do conector está ausente por enquanto.
- Validar o fluxo OAuth/MCP completo em ambiente de teste, incluindo revogação, concorrência real, renovação de token, limites, isolamento e App Check. A inicialização OAuth, a descoberta de recurso e a recusa sem token foram testadas localmente; o login real não foi testado.
- Implementar e testar o suporte à segunda marca. Atualmente, o conector é apenas VFIT.
- Revisar a política, atualizar o plano e obter revisão cruzada antes de disponibilizar dados reais.
