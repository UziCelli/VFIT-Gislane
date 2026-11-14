# Validação local — 14/11/2026

Ambiente: Node 24.22.1, Java 21; base `1d3c230`. Sem credenciais de produção; emuladores usam `demo-forca`.

| Verificação | Resultado |
|---|---|
| `npm ci --ignore-scripts` | Concluído com lockfile; sem alteração de dependências |
| `npm run typecheck` | Aprovado, incluindo tipos Cloudflare |
| `npm test` | 75 arquivos / 1.114 testes aprovados; inclui 3 testes iniciais do novo leitor |
| `npx vitest run push/src/corpo.test.ts push/src/validar.test.ts` | 43 testes aprovados após acrescentar caso legado `{}` |
| `npm run build` e `npm run build:gislane` | Aprovados; 21 entradas precache por marca; verificador de artefatos aprovado |
| Fixtures sintéticas do verificador | Arquivo JS público aceito; `.map`, `.env`, JSON service_account e symlink recusados (exit 1); somente paths impressos |
| `npm audit --omit=dev` | 0 vulnerabilidades reportadas pelo registro nesta execução; não cobre ferramentas nem ameaças desconhecidas |
| `git diff --check` | Aprovado |
| Gitleaks 8, histórico local completo | 293 commits / ~459 MB; 32 ocorrências redigidas classificadas; reexecução com fingerprints: 0 alertas não ignorados (37,7 s) |
| `npm run test:rules` | 8 arquivos / 395 testes aprovados (160,85 s), exit 0. Avisos de metadados/rede e múltiplos projetos demo não impediram o resultado |
| Graphify | Instalado localmente após binário inicialmente ausente; `query` e `update .` executados sem LLM/API |
| E2E UI | Não executado: nenhum fluxo de tela alterado. Update/rollback PWA em staging continua pendente |

Compatibilidade `/desinscrever`: versão histórica `1459c61`, `src/lib/push.ts`, envia `{}`; leitor novo aceita `{}` e mantém ausência de endpoint → desinscrever todos. Corpo vazio/malformado passa a retornar 400, excesso retorna 413, sem executar desinscrição. Cliente atual envia endpoint por aparelho. `validar.test.ts` cobre remoção individual e `semAparelho(undefined)`.

Avisos já observados nos builds: bundle maior que 500 kB e imports dinâmicos ineficazes de Firebase/App Check. Não são prova de vulnerabilidade, nem foram alterados neste trabalho.

Nenhum deploy, alteração de IAM/branch protection, banco, custo, sessão ou segredo. Reverter os arquivos desta entrega desfaz controles novos; não requer migração de dados. Revisão cruzada Claude obrigatória antes de juntar/publicar.

## Varredura de histórico

Relatório redigido mantido fora do repositório. Foram encontrados 32 alertas: `.env.gislane` (2), `.env.production` (3), `graphify-out/cache/stat-index.json` (26) e `push/src/webpush.test.ts` (1). Triagem por versão histórica:

- As 5 linhas `.env` correspondem a `VITE_FIREBASE_API_KEY` (configuração pública Firebase) e `VITE_RECAPTCHA_KEY` (chave pública do site reCAPTCHA).
- As 26 ocorrências no cache são hashes SHA-256 hexadecimais no campo `hashes` do índice Graphify; o scanner confundiu nome de arquivo contendo “api” com credencial.
- A fixture de `webpush.test.ts` reproduz o vetor público RFC 8291, Apêndice A, conforme comentário no próprio teste.

`.gitleaksignore` registra somente os 32 fingerprints exatos, com comentários de classificação. Não ignora paths inteiros nem futuras ocorrências. Não são 32 segredos ativos confirmados, e a triagem não comprova segurança das contas. Nunca publicar valores dos candidatos em comentários/logs.
