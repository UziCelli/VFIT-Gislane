# Conector MCP — revisão e continuação

Este PR ainda é um rascunho e não deve ser integrado nem publicado.

## Alterações realizadas

- As rotas do conector foram encaminhadas no código do Worker `vfit-descanso`, atrás da variável `MCP_ENABLED`; sem ela, o conector fica desligado. Não há outro Worker para publicar.
- Cada pedido OAuth usa uma instância própria do Durable Object existente. Seu consumo é transacional, para impedir duas aprovações simultâneas. As concessões OAuth ainda precisam do KV.
- A verificação do token renovado exige o mesmo usuário e projeto. A tela informa que esta entrega só faz leitura.

## Antes de ligar

- Provisionar um namespace KV gratuito e vinculá-lo ao Worker como `OAUTH_KV`. Incluir seu ID na configuração versionada ou no processo de publicação, sem apagar bindings existentes. O token de publicação precisa ter acesso aos recursos usados. Conferir as cotas e o plano da conta; custo zero depende do volume e das configurações.
- Configurar no Worker `MCP_ENABLED=true`, `MCP_RESOURCE=https://vfit-descanso.vfitcoach-site.workers.dev/mcp`, `APP_URL=https://app.vfitcoachapp.com`, `PROJETO=forca--app` e `FIREBASE_API_KEY` com a chave web pública do projeto. Essas configurações ainda não estão prontas para publicação automática.
- Validar fluxo completo OAuth/MCP em ambiente de teste, incluindo revogação, concorrência real, renovação de token, limites de uso, isolamento e comportamento com App Check. Validar notificações existentes e as duas marcas após alterar o Worker.
- Esta entrega só lê dados e atende VFIT. Criar e ajustar treinos exige outra entrega, com rascunho revisado pelo coach e sem alterar cargas dos alunos.
- Atualizar o plano e o mapa, revisar a política e realizar a revisão cruzada. Não conectar dados reais antes de concluir as verificações.
