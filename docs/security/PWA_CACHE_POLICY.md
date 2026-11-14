# Política de cache PWA

| Dado | Implementação atual | Política e risco |
|---|---|---|
| JS/CSS/HTML/ícones/fontes/JSON públicos | Workbox precache versionado (`vite.config.ts`), sem runtimeCaching | Público, contém motor e catálogo; extraível |
| HTML e `/sw.js` | Hosting no-cache | Atualização controlada pelo deploy; shell precache continua offline |
| `/sw-push.js` | Importado pelo SW; no-cache acrescentado no Hosting | Mesma revisão do worker; validar após deploy |
| APIs Auth/Firestore | Não passam por cache runtime Workbox | Servidor autoriza; SDK Firestore mantém IndexedDB separadamente |
| Saúde/treinos/mesos | IndexedDB persistente multiaba (`firebase.ts`) | Requisito offline existente; dados privados permanecem no aparelho até limpeza |
| Chave IA nova | Durable Object servidor | Nunca devolver chave bruta; respostas da API no-store; legado pode existir em aparelhos antigos |
| Notificações e IA Worker | JSON no-store por padrão | `/vapid` é chave pública com max-age=86400 |
| Logout/troca de conta | Espera gravações, coordena abas, termina SDK, apaga IndexedDB, encerra sessão | Sem rede e fila pendente recusa saída para não perder cargas. Fechar abas antigas que impeçam limpeza |

## Limites deliberados

Premium offline não tem revogação imediata. Alterar o relógio/JS não concede permissão online nas regras, mas não recolhe dados entregues. Dados de saúde offline exigem aparelho protegido e avaliação de necessidade/consentimento. Não retirar persistência silenciosamente: faria perder funcionalidade e arriscaria gravações pendentes.

Atualização usa `registerType: autoUpdate`; novo SW pode assumir enquanto abas usam chunks antigos. O login verifica `versao.json` e recarrega uma vez por versão (`atualizar.ts`). Não foi alterado nesta entrega para evitar regressão; planejar teste de install→waiting→activate, abas abertas e versões consecutivas antes de redesenhar esse fluxo.

## Validação após publicação autorizada

1. Em staging com dados fictícios: instalar v1, registrar carga offline, publicar v2, abrir segunda aba, voltar online e conferir sincronização sem perda.
2. Atualizar, sair, entrar com outra conta; confirmar ausência de documentos privados da primeira no IndexedDB. Repetir sem rede: deve preservar fila e explicar falha da saída.
3. Expirar/bloquear conta no emulador: novo acesso online negado; registrar que cópia offline continua possível.
4. Conferir no navegador cabeçalhos `/sw.js`, `/sw-push.js`, HTML e JSON Worker. Não inferir cache HTTP a partir do IndexedDB.

## Incidente e rollback

Interromper promoção da versão suspeita; preservar evidências. Responsável publica build limpo e SW no mesmo escopo, mantém assets da versão anterior enquanto houver abas antigas e valida atualização. Reverter commit/republicar última versão conhecida não remove worker já instalado até o cliente buscar a atualização. Revogar sessões/chaves comprometidas no servidor e orientar atualização; nunca apagar IndexedDB indiscriminadamente enquanto houver cargas pendentes. Se houver chave IA legada no aparelho, atualizar, sincronizar/sair e rotacionar a chave no provedor.
