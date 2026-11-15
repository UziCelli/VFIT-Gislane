# Conector MCP — revisão e continuação

O Victor autorizou o Codex a revisar e integrar sem aguardar o Claude. O teste com conta real ocorre após a publicação.

## Alterações realizadas

- O conector usa o Worker separado `vfit-conector`, criado pelo Victor. O Worker `vfit-descanso` continua responsável pelas notificações.
- O KV `vfit-mcp-oauth` foi vinculado na configuração usando o namespace informado pelo Victor. Os limites gratuitos são compartilhados pela conta Cloudflare.
- Cada pedido OAuth usa um Durable Object próprio do conector. Seu consumo é transacional para impedir duas aprovações simultâneas. A verificação do token renovado exige o mesmo usuário e projeto.
- A tela informa que esta entrega só faz leitura. A criação e o ajuste de treinos ficam para entrega posterior, como rascunho revisado pelo coach, sem alterar cargas dos alunos.

## Antes de ligar

- O workflow de publicação independente está preparado para executar após merge na main e passa `FIREBASE_API_KEY` a partir da configuração web pública. Confirmar na primeira publicação se o token da Cloudflare tem as permissões necessárias; não houve deploy do conector.
- Validar o fluxo OAuth/MCP completo em ambiente de teste, incluindo revogação, concorrência real, renovação de token, limites, isolamento e App Check. A inicialização OAuth, a descoberta de recurso e a recusa sem token foram testadas localmente; o login real não foi testado.
- Implementar e testar o suporte à segunda marca. Atualmente, o conector é apenas VFIT.
- Revisar a política e atualizar o plano. Revisão do Claude poderá ser feita depois, conforme autorização do Victor.

## Validações locais

- 1.146 testes unitários, 395 testes das regras no emulador, typecheck e builds das duas marcas passaram.
- Quatro testes de navegador passaram com Firebase emulado e conector simulado.
- Wrangler local: descoberta OAuth, registro dinâmico, autorização até a tela, cancelamento e rejeição sem token passaram. A aprovação real com Firebase/MFA e chamadas autenticadas ainda não foram testadas.
