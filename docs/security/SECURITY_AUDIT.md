# Auditoria de segurança — 14/11/2026

Escopo e arquitetura em `THREAT_MODEL.md`. Revisão estática, testes locais e build; não é pentest nem atestado de ausência de falhas. Evidências indicam caminhos, sem credenciais/dados pessoais. Níveis consideram impacto × probabilidade × exposição.

## Correções entregues

| ID | Achado comprovado e cenário | Severidade/esforço | Correção/princípio | Validação e residual |
|---|---|---|---|---|
| A01 | `push/src/index.ts`: `lerJson` e `/desinscrever` usavam `req.text()` antes do teto; usuário autenticado poderia enviar corpo excessivo; teto contava caracteres | Média/baixo | `push/src/corpo.ts`: limita streaming por bytes, cancela excesso, rejeita UTF-8/JSON inválido; compartilhado com IA | `corpo.test.ts`: limite exato, tamanho UTF-8, Content-Length falso, cancelamento e JSON inválido. Runtime/borda ainda deve limitar concorrência |
| A02 | Respostas JSON autenticadas e de erro sem política explícita de cache (IA sucesso já usava no-store) | Média/baixo | `Cache-Control: no-store` por padrão; `/vapid` continua público | Revisão do helper de resposta. Não apaga cópias já recebidas |
| A03 | `firebase.json` só ignorava config/node_modules; não havia barreira contra `.map`/credenciais reconhecíveis no dist | Média/baixo | Exclusões explícitas + `tools/verificar-build.mjs` integrado aos builds das duas marcas | Build real e fixtures sintéticas rejeitadas. Padrões não identificam todo segredo; scanner de histórico executado com triagem documentada em VALIDATION.md |
| A04 | CSP ainda autorizava Anthropic diretamente após migração para Worker; `sw-push.js` sem cache explícito | Baixa/baixo | Retira origem desnecessária e define no-cache para script importado | Builds e revisão config; validar cabeçalho efetivo após aprovação/publicação |
| A05 | Sem configuração versionada de updates de dependências/Actions | Baixa/baixo | `.github/dependabot.yml`, semanal | Revisão YAML; geração real de PR depende do GitHub |

## Matriz T01–T30

“Não encontrado” significa controle identificado no escopo, não garantia. “Não verificado” exige evidência adicional.

| ID | Estado | Evidência/limite |
|---|---|---|
| T01 | Não encontrado online; risco offline confirmado | `firestore.rules`: `liberado`, `isCoach`; cache não revogável |
| T02 | Não encontrado no código revisto | Regras Firestore e `push/src/acesso.ts`; testes de regras existentes |
| T03 | Não encontrado no código revisto | `own`, uid da sessão; suites `ataques`/`rules`/`fisio-rules` |
| T04 | Não aplicável ao fluxo atual | Pix + renovação manual, sem checkout com total cliente |
| T05 | Não aplicável ao fluxo atual | Sem webhook de pagamento; reavaliar ao integrar gateway |
| T06 | Não verificado em produção | Auth Firebase; aparelho/XSS ainda ameaça; não é sessão HTTP própria |
| T07 | Parcial; 32 alertas históricos classificados | Gitleaks executado no histórico local; 32 ocorrências de configuração pública, teste e hashes de cache classificadas; 6 fingerprints exatos e allowlist do cache gerado revisada pelo Claude; ver `VALIDATION.md`. Validade/credenciais do provedor não auditadas |
| T08 | Não verificado no provedor | Jobs main; segredo de repositório não é isolado de YAML malicioso |
| T09 | Parcial | Lockfile; updates versionados; auditar ferramentas e scripts de instalação |
| T10 | Parcial | Worker gerado, versão precache; recuperação documentada; deploy real não testado |
| T11 | Confirmado por requisito | IndexedDB guarda treino e saúde offline; logout sincroniza e limpa |
| T12 | Confirmado/risco de produto | Cliente offline pode copiar dados e alterar relógio/código |
| T13 | Prevenido parcialmente | Vite sem sourcemaps por padrão; trava dist e ignore Hosting |
| T14 | Não verificado | Registro marca/DNS/DMARC e clones dependem do titular |
| T15 | Confirmado | Repositório público e motor enviado ao browser |
| T16 | Parcial | Worker com limites; Firestore quotas/cadastro aberto exigem monitoramento |
| T17 | Parcial | React escape e CSP sem unsafe-eval; CSP remove origem IA; não houve pentest |
| T18 | Parcial | Worker exige bearer JWT; não usa cookie de sessão próprio; revisar novas rotas |
| T19 | Não encontrado no escopo | SDK/REST Firestore; sem SQL/shell recebendo payload da API |
| T20 | Parcial | `push/src/validar.ts` restringe endpoint push; IA URL fixa; fornecedor externo é confiança |
| T21 | Parcial | Fotos JPEG com tamanho nas regras; importador XLSX limitado; sem Storage público neste fluxo |
| T22 | Não verificado no provedor | Enumeração/senha/App Check em docs não provam console atual |
| T23 | Parcial | MFA no backend coach; MFA de GitHub/Google/Cloudflare não verificado |
| T24 | Não verificado | DNS, registrador, transferência, subdomínios |
| T25 | Parcial | Fontes locais; CSP permite reCAPTCHA necessário; revisar novos terceiros |
| T26 | Parcial | `tools/backup.mjs` e workflow backup cifram; restauração e retenção reais não verificadas |
| T27 | Parcial | Logs quota backend e política; inputs manuais de workflows públicos têm risco de PII |
| T28 | Confirmado offline; controle online presente | `request.time`/`pagoAte` + 7 dias de carência; cache acesso Worker documentado |
| T29 | Pendente jurídico | Inventário de licenças gerado; obrigações precisam revisão |
| T30 | Pendente titular | Contratos, autoria e direitos de imagens/fontes não comprovados pelo git |

Não há base para listar dez vulnerabilidades críticas comprovadas; não se fabricam achados para preencher quantidade. Pendências priorizadas em `REMEDIATION_PLAN.md`.
