# Prescrição pelo conector MCP — VFIT

## Situação

O conector oferece leitura e permite que um assistente prepare uma proposta de mesociclo para o coach revisar e aprovar no app. A remoção de exercícios descrita abaixo está em desenvolvimento e aguarda publicação.

## Como usar

1. No app VFIT, entre como coach e conclua a verificação em duas etapas.
2. No assistente MCP já conectado, solicite uma proposta para um aluno. O assistente prepara a prescrição; isso, por si só, não grava o treino.
3. Abra a confirmação no app e confira a proposta. Somente a aprovação explícita do coach autenticado com MFA grava as alterações.
4. O treino segue o fluxo normal de mesociclo do app e a agenda existente, inclusive a sequência do próximo treino. A proposta pendente fica temporariamente no Worker, isolada por conta, expira em 15 minutos e não cria uma coleção de rascunhos no app.

Concessões OAuth anteriores continuam apenas com leitura. Para obter a nova permissão de prescrição, desconecte o conector e conecte novamente, aceitando o consentimento atualizado. A aprovação de cada proposta continua sendo necessária.

## Diagnosticar uma conexão

No assistente conectado, execute `verificar_conexao` para consultar o estado atual da autorização. A resposta informa se a conexão está `aprovada`, `somente_leitura` ou `incompleta`, se pode preparar propostas e que a confirmação acontece no app. Ela não inclui UID, tokens ou outros dados de identidade.

O pedido de consentimento novo exige que o app envie a versão 2 depois de mostrar as permissões. Se o app em cache estiver desatualizado, o conector rejeita o pedido com a orientação para atualizar o app e reabrir o pedido original; não conclui a conexão silenciosamente como somente leitura. A mensagem para reconectar, sozinha, não confirma a causa: use `verificar_conexao` para conferir o estado registrado.

## Limites e cuidados

- A IA prepara uma sugestão; o coach continua responsável por revisar e aprovar o treino.
- Se a validação do mesociclo salvo falhar, a ferramenta informa apenas a região a conferir no app, sem incluir valores ou dados do aluno.
- A autorização de escrita depende de coach autenticado com segundo fator (MFA) e da nova concessão OAuth.
- A integração não substitui o fluxo de registro do aluno nem edita cargas ou repetições já anotadas. Os registros existentes devem ser preservados.
- A remoção de exercícios da divisão pode ser proposta pelos IDs obtidos em `ver_mesos` (`divisaoPlanejada`). A confirmação mostra os exercícios e os treinos afetados. As cargas continuam guardadas; os exercícios removidos deixam de aparecer no plano e sessões presenciais já ajustadas permanecem como estavam. Outras alterações estruturais em mesociclos existentes continuam restritas.
- O uso e envio de dados ao fornecedor do assistente precisam estar descritos na Política de Privacidade e aceitos antes de ativar a escrita.
- A remoção de exercícios pelo assistente ficará disponível após a publicação dessa extensão.
