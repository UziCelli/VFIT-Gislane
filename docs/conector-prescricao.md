# Prescrição pelo conector MCP — VFIT

## Situação

Esta entrega está em desenvolvimento e **ainda não foi publicada**. O conector existente oferece leitura. Esta extensão permitirá que um assistente prepare uma proposta de mesociclo e que o coach a revise e aprove no app.

## Como usar quando estiver disponível

1. No app VFIT, entre como coach e conclua a verificação em duas etapas.
2. No assistente MCP já conectado, solicite uma proposta para um aluno. O assistente prepara a prescrição; isso, por si só, não grava o treino.
3. Abra a confirmação no app e confira a proposta. Somente a aprovação explícita do coach autenticado com MFA grava as alterações.
4. O treino segue o fluxo normal de mesociclo do app e a agenda existente, inclusive a sequência do próximo treino. A proposta pendente fica temporariamente no Worker, isolada por conta, expira em 15 minutos e não cria uma coleção de rascunhos no app.

Concessões OAuth anteriores continuam apenas com leitura. Para obter a nova permissão de prescrição, desconecte o conector e conecte novamente, aceitando o consentimento atualizado. A aprovação de cada proposta continua sendo necessária.

## Limites e cuidados

- A IA prepara uma sugestão; o coach continua responsável por revisar e aprovar o treino.
- A autorização de escrita depende de coach autenticado com segundo fator (MFA) e da nova concessão OAuth.
- A integração não substitui o fluxo de registro do aluno nem edita cargas ou repetições já anotadas. Os registros existentes devem ser preservados.
- O uso e envio de dados ao fornecedor do assistente precisam estar descritos na Política de Privacidade e aceitos antes de ativar a escrita.
- Enquanto a entrega não for publicada e validada, a escrita não está disponível em produção; use o conector apenas para leitura.
