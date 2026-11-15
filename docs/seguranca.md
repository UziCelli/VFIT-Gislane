# Segurança — entrada curta

O guia ativo é [SECURITY.md](../SECURITY.md): controles, limites, incidentes e links para evidências.

O antigo roteiro de console foi preservado em [seguranca-historico.md](seguranca-historico.md). Ele contém informações datadas; não aplicar passos nem assumir pendências concluídas sem verificar a configuração atual.

## App Check do conector — operação atual
 (15/11/2026)
- **Risco:** o Worker do conector usa um *debug token* de App Check (segredo `APPCHECK_DEBUG_TOKEN` na Cloudflare). Quem o tiver contorna o App Check do Firestore.
- **Mitigação:** o App Check não é a única barreira. O `idToken` do coach, com 2º fator, continua obrigatório e o `firestore.rules` decide tudo. O token nunca é logado nem aparece em erro.
- **Configurar pela primeira vez:**
  1. Gere um UUID aleatório em um local privado (por exemplo, execute `node -e "console.log(require('node:crypto').randomUUID())"` no seu computador). Não coloque o valor no chat.
  2. Abra [App Check do projeto VFIT](https://console.firebase.google.com/project/forca--app/appcheck/apps), encontre o app web e, no menu de três pontos, escolha **Gerenciar tokens de depuração**. Adicione o UUID e dê um nome para identificá-lo.
  3. Abra [segredos de Actions do repositório](https://github.com/UziCelli/claude-cloud-celli/settings/secrets/actions), escolha **New repository secret** e salve o mesmo valor com o nome `APPCHECK_DEBUG_TOKEN`.
  4. Se a chave web tiver restrições de API, em [Credenciais do Google Cloud](https://console.cloud.google.com/apis/credentials?project=forca--app) confira que ela permite **Firebase App Check API**. Mantenha também as APIs já necessárias ao app.
  5. Execute [Publicar conector do Claude](https://github.com/UziCelli/claude-cloud-celli/actions/workflows/conector.yml) na branch `main`. O workflow testa a troca no Firebase antes de atualizar o segredo e publicar; se falhar, confira os passos acima.
- **Rotação:** repita os passos com outro UUID. Após a publicação bem-sucedida, apague o token antigo no Firebase.
