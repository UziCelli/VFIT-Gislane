# Conector MCP VFIT — contrato e operação

## Funcionamento

O mesmo endpoint `https://vfit-conector.vfitcoach-site.workers.dev/mcp` atende ChatGPT e Claude por Streamable HTTP e OAuth com PKCE S256. O conector usa o login do coach, MFA e as regras do Firestore. Não recebe credencial administrativa.

A IA consulta e prepara propostas; **só o botão Salvar treino no app confirma uma alteração**. Novas propostas expiram em 24 horas; propostas criadas antes da mudança conservam o prazo original. Consultar uma proposta, inclusive para recuperar uma resposta perdida, nunca confirma uma proposta ainda não aprovada.

A autorização OAuth v2 existente continua válida. Concessões antigas de leitura precisam de novo consentimento para preparar. Não reconectar por rotina: `verificar_conexao` separa autorização, dependências, versão publicada e preparação habilitada. O Worker só prepara quando `EDICAO_COMPLETA=1`; desligar essa variável mantém as consultas disponíveis.

## Ferramentas e exemplos

- `verificar_conexao`: renova e verifica o login, identidade/MFA, App Check, papel do coach e leitura do armazenamento de propostas. Não retorna UID nem credenciais. `build` identifica o commit publicado.
- `ver_mesos(alunoId, mesoId?, incluirPrescricao?)`: resumo por semana, IDs e origem dos exercícios (`divisao`, `troca`, `adicao`, `presencial`, `registrada`). `incluirPrescricao=true` exige `mesoId` e acrescenta configuração completa e `versao`.
- `preparar_treino`: `acao` é `criar`, `proximo` ou `editar`; edição exige `mesoId`. `versao` opcional deve ser copiada da consulta para recusar uma base desatualizada.
- `consultar_proposta(id)`: estado privado da proposta; reconcilia gravação pendente pelo comprovante, sem repetir a escrita.

Prefira `alteracoes` para pedidos pontuais. Não combine esse campo com `meso` ou `removerSlotIds`.

| tipo | Parâmetros principais | Efeito |
|---|---|---|
| adicionar | treino, nome, referencia?, antesDeSlotId? | UUID novo no servidor; nome do catálogo; fim da divisão por padrão |
| substituir | slotId, nome | Nova identidade; preserva linhas próprias e sessões registradas |
| remover | slotId | Retira da divisão e remapeia métodos/trocas |
| mover | slotId, antesDeSlotId? | Reordena dentro do mesmo treino; sem destino move ao fim |
| prescricao | slotId, semanas, reps, pausaS?, doisLados? | Altera séries/reps das semanas; pausa e carga por lado pertencem ao slot |
| metodo | slotIds, semanas, metodo, remover?, escopo?, ajustes? | Aplica/remove método, usando o motor e grupos válidos |
| configurar | inicio?, semanas?, frequencia?, dias?, pausaS?, pausaPrincipaisS?, tempoLimiteMin?, progressaoPct? | Configuração do ciclo |

`referencia` identifica localmente um exercício recém-adicionado no mesmo lote; operações seguintes podem usá-la como `slotId`. IDs locais devem ser distintos dos IDs existentes. As operações de slot atuam na divisão planejada; trocas/adições semanais podem ser ajustadas pela prescrição completa em `meso`. Mudanças são validadas integralmente: uma operação inválida recusa o lote todo.

Após `substituir`, o ID original ou a referência local continua válido para as operações seguintes do lote. A progressão só é copiada entre exercícios da mesma modalidade: mudar entre isometria e movimento dinâmico reinicia a linha na unidade correta e limpa contagens antigas dos métodos, preservando grupos, pausas e blocos. O lote pode definir as contagens novas depois da substituição. A extensão de semanas também conserva o padrão em segundos para isométricos.

Exemplo com IDs fictícios:

```json
{"acao":"editar","alunoId":"aluno","mesoId":"ciclo","alteracoes":[{"tipo":"remover","slotId":"face1"},{"tipo":"remover","slotId":"face5"}]}
```

`removerSlotIds` continua aceito para compatibilidade. A prescrição completa usa o contrato comum do editor: 1–7 treinos, 1–12 semanas, até dez exercícios efetivos por sessão e seis séries. Séries vazias ficam no fim; `[10,null,20]` é recusado. Exercícios legados existentes podem ser mantidos/copiados; identidades não podem ser reaproveitadas para outro exercício. Novos exercícios usam o catálogo.

No editor, reduzir semanas ou dias retira métodos, trocas e adições do intervalo descartado antes de validar o salvamento. Sessões e cópias históricas permanecem preservadas. O estado “Salvo” aguarda a confirmação da gravação; enquanto ela estiver pendente, outro salvamento e o aviso ao aluno ficam desabilitados.

## Histórico e concorrência

- Qualquer documento de registro protege a sessão, inclusive registro parcial, carga zero, reps e carga por lado. A prescrição resolvida é guardada em `prescricoesRegistradas`; o plano futuro pode mudar sem alterar esses exercícios, séries, métodos e pausas.
- O conector nunca grava cargas/reps nem regrava `sessoes` presenciais. Ajustes presenciais continuam prevalecendo; a prévia mostra as sessões protegidas e os treinos antes/depois.
- Edição presencial explícita conserva séries e pausas congeladas nas posições não alteradas. As cópias novas incluem as repetições antes dos métodos: remover um Clusterset restaura essa prescrição-base. Cópias legadas sem esse campo conservam as repetições resolvidas; não é possível reconstruir uma base ausente. Salvar essa edição ou voltar ao planejado marca somente aquela cópia como invalidada; uma futura edição MCP captura a prescrição então vigente.
- App novo guarda uma cópia limitada e imutável no início do registro. Isso permite reconhecer a prescrição quando a fila offline chegar depois da edição. A gravação de cargas continua independente dessa cópia.
- Clientes antigos podem sincronizar sem versão. `prescricoesAnteriores` guarda referências anteriores das sessões alteradas; quando aplicáveis, elas são exibidas com aviso de histórico incerto. Referência anterior não comprova qual prescrição foi usada. Dados brutos permanecem guardados; não se inventa uma confirmação histórica.
- Em ciclo já iniciado, MCP não reduz duração/frequência nem muda o início, mesmo sem registros visíveis: pode haver fila offline. Prepare o próximo ciclo nesses casos. Mudanças nos dias também não podem deslocar sessões já registradas.
- O início do próximo ciclo é validado após todas as operações: pode ser adiado, mas não antecipado para sobrepor o ciclo atual.
- A confirmação exige as versões do mesociclo, da origem da cópia e dos registros existentes/ausentes conferidos na preparação. O perfil do aluno **não** entra: ele muda por ações do próprio aluno (peso, aceite, pagamento) e derrubaria propostas válidas. Registro ou edição concorrente exige outra proposta.
- A cópia `prescricaoRegistrada` vem do aluno e não é confiável: se contradiz nome/identidade do plano ou do histórico, é ignorada (usa-se a prescrição vigente) e nunca bloqueia a edição.
- A prévia lista, calculado no servidor a partir do dado real, cada exercício retirado ou incluído na divisão (`diferencas`); o nome da proposta é texto livre do assistente e aparece como "Nome proposto".
- Estado `resultado_pendente` só existe depois de o commit começar. Falha antes dele deixa a proposta válida para nova tentativa. Sem comprovante 10 minutos depois da tentativa, a proposta passa a "não salva".
- Desligar a edição: variável do repositório `EDICAO_COMPLETA=0` (Settings → Secrets and variables → Actions → Variables) e rodar o workflow. Sem valor = ligada.
- Alteração e comprovante privado `mcpOperacoes` são gravados em um commit. Uma resposta perdida é reconciliada pelo comprovante, mesmo que outro ajuste tenha substituído o marcador do mesociclo. Comprovantes não contêm treino, são imutáveis e a limpeza diária os remove após 30 dias.
- Há limites explícitos de tamanho: documento até 900 KB de JSON e proposta até 1,8 MB. Histórico nunca é truncado para caber. Use um próximo ciclo se o limite impedir a proposta.

Atualize a PWA para visualizar os campos históricos novos; versões antigas continuam podendo enviar registros, mas não interpretam esses campos.

## Configuração e publicação

| Local | Configuração | Evidência ou procedimento |
|---|---|---|
| Firebase | Projeto `forca--app`; Auth e MFA do coach; perfil `papel=coach`; regras | Login e chamadas reais exigem MFA. Publicar as regras novas antes do Worker. |
| Google Cloud | Chave web autoriza Secure Token, Firestore e Firebase App Check, com o domínio do app | Renovação e troca App Check enviam o Referer do app; não remover restrições por conveniência. |
| Firebase App Check | Debug token registrado no app web correto | Workflow já verifica a troca antes de publicar. Configuração/rotação em [segurança](seguranca.md). |
| GitHub secrets | `APPCHECK_DEBUG_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; credencial Firebase existente para deploy do app/regras | Não colocar valores no chat ou no repositório. O conector em execução não usa a credencial administrativa. |
| Cloudflare | Worker `vfit-conector`; KV `OAUTH_KV`; DOs SQLite `PEDIDOS`/`PROPOSTAS`, migrações v1/v2 | Reutilizar recursos existentes. Token precisa publicar Worker, acessar KV/migrações e consultar o subdomínio. |
| Variáveis Worker | `PROJETO`, `APP_URL`, `MCP_RESOURCE`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `BUILD_ID`, `EDICAO_COMPLETA` | As três primeiras estão no Wrangler; workflow fornece chave/app ID públicos, SHA e flag. |
| App | `VITE_CONECTOR_URL`, CSP e rotas de consentimento/confirmação | Manter domínio correto e respostas privadas sem cache. |
| Assistente | Mesmo endpoint `/mcp`, OAuth/DCR, ferramenta de preparação habilitada, política da conta permite escrita | Atualizar catálogo de ferramentas após publicar; não criar outro conector nem revogar concessões válidas sem necessidade. |

O workflow do conector aguarda o job VFIT `deploy` do mesmo commit publicar app e regras. Se ele falhar ou a espera expirar, não atualiza o Worker. Para desativar a preparação, use `EDICAO_COMPLETA=0`; leituras permanecem disponíveis. A reversão deve preservar KV, DOs e migrações; não apagar recursos para tentar corrigir conexão.

Na revisão de 16/11/2026, OAuth público respondeu 200, MCP sem token respondeu 401, a conexão existente informou consentimento aprovado e a última publicação registrou sucesso no App Check e bindings. Isso não certifica toda configuração atual do console nem valida a nova versão em produção. Confirme pelo `build` e pelos testes nos dois assistentes após publicar.

O ChatGPT pode conservar definições antigas até atualizar as ferramentas: [orientação oficial](https://help.openai.com/en/articles/12584461). No Claude, o endpoint deve ser acessível pela infraestrutura da Anthropic: [orientação oficial](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). Plano e políticas do assistente podem limitar ações; esse bloqueio não é corrigido por mudanças no Firebase.

## Erros e diagnóstico

Erros MCP preservam texto compatível e acrescentam `codigo`, `etapa`, `podeTentarNovamente` e `idDiagnostico`. O log operacional guarda somente código, etapa e identificador aleatório — nunca stack, corpo, token, UID, nome ou dado de saúde.

| Situação | Tratamento |
|---|---|
| Autorização somente leitura/incompleta | Novo consentimento apenas quando necessário; manter MFA |
| `IDENTIDADE_MFA` | Login renovado não corresponde à identidade/projeto/MFA |
| `APPCHECK` / `CONFIG_APPCHECK` | Conferir registro, segredo, app ID e APIs permitidas |
| `VALIDACAO`, `VERSAO`, `HISTORICO`, `HISTORICO_OFFLINE`, `CALENDARIO` | Corrigir parâmetros, consultar novamente ou preparar próximo ciclo |
| `FIRESTORE_401/403` na confirmação | Recusa definitiva; conferir login/App Check/regras; não deixar pendente |
| Conflito, dados inválidos ou quota com recusa explícita | Recusar sem aplicar parcialmente; preparar novamente após resolver |
| `RESULTADO_DESCONHECIDO` | Consultar comprovante; não repetir cegamente a gravação |
| `ARMAZENAMENTO` / `TAMANHO` | Conferir DOs, cotas e tamanho; nenhum treino foi alterado pela preparação |
| `INTERNO` | Guardar identificador e etapa para investigação, sem expor dados |

## Verificação

- `npm run typecheck`, `npm test` e builds VFIT/Gislane.
- `npm run test:rules`: autenticação, isolamento, comprovantes, histórico, concorrência e limpeza com regras reais.
- `npx firebase emulators:exec --only auth,firestore --project demo-forca 'npm --prefix conector run test:runtime'`: OAuth/PKCE, cliente MCP HTTP, DOs/RPC/SQLite, Firestore e confirmação no navegador. Usa somente dados fictícios e saídas Google interceptadas; assinatura/MFA vêm de uma fixture de teste. O proxy do navegador encaminha ao Worker real, sem fabricar respostas de negócio. Não substitui login/MFA e políticas reais dos assistentes. Chromium pode ser indicado por `PW_CHROMIUM`.
- Após publicação: em ChatGPT e Claude, consultar → preparar no aluno fictício → abrir prévia → confirmar → verificar treino e histórico. Registrar a versão e não apresentar um teste simulado ou não executado como aprovação em produção.
