# Modelo de ameaças — 14/11/2026

Referência: guia mestre fornecido pelo proprietário e OWASP ASVS 5.0.0, sem certificação. Escopo: commit-base `1d3c230`, código local; nenhum teste ativo em produção.

## Inventário e fronteiras

- React/TypeScript/Vite/Tailwind; duas marcas no mesmo código (`marcas/vfit`, `marcas/gislane`). PWA em Firebase Hosting; manifest e worker gerados por vite-plugin-pwa/Workbox (`vite.config.ts`).
- Firebase Auth + Identity Platform/TOTP; regras `firestore.rules` são a autoridade para papel, dono e pagamento. Cliente usa SDK Firestore com IndexedDB persistente e múltiplas abas (`src/lib/firebase.ts`).
- Cloudflare Worker + Durable Objects (`push/src/`) verifica JWT Firebase, papel/MFA via Firestore, envia notificações e intermedeia Anthropic. Chave IA permanece no DO; legado Firestore é migrado pelo servidor. Configuração real publicada: NÃO VERIFICADA.
- Cobrança Pix e renovação manual pelo coach; não há gateway/webhook de confirmação de pagamento neste código. Avisar pagamento não libera plano; `pagoAte` é protegido nas regras.
- GitHub Actions: CI unitário/regras/E2E; deploy Firebase e Cloudflare; manutenção, backups criptografados, vigia e APK/TWA. Segredos referenciados por nome, nunca inventariados por valor.
- Algoritmos do treino e catálogo (`src/engine`, `src/data`) são enviados ao navegador. Não são secretos. Migração para backend depende de decisão sobre offline, custo e desempenho.

Ativos: dados de saúde e treino, identidade/sessões, chaves de IA e publicação, planos, backups, código/marca, disponibilidade e quotas gratuitas. Atores: aluno legítimo/malicioso, visitante, coach, colaborador, fornecedor comprometido, atacante com aparelho desbloqueado.

Fronteiras: navegador não confiável → Auth/regras Firestore; navegador → Worker JWT/Firestore → DO/Anthropic/push; colaborador/PR → CI → credencial de deploy → Firebase/Cloudflare; aparelho → IndexedDB compartilhado. CORS/App Check são defesa adicional, não substituem autorização.

## Riscos principais

1. Alta: dados já recebidos ficam disponíveis offline; relógio/JS locais não garantem expiração nem revogação imediata. Preservado o requisito do produto.
2. Alta: configuração de ambientes GitHub, IAM, proteção de branch, App Check, domínio, MFA do provedor e recuperação depende de inspeção/autorização do responsável.
3. Média: corpos de requisição grandes podiam ser integralmente alocados antes de conferir tamanho; corrigido por leitura incremental com teto em bytes.
4. Média: novos artefatos internos poderiam ser publicados sem trava de build; corrigido com verificação de saída e exclusões de Hosting.
5. Média: código/ativos públicos podem ser copiados. Tornar privado não recolhe cópias existentes; proteção jurídica e lógica servidor devem ser proporcionais.

Nenhuma regra ou dado foi migrado; nenhum segredo foi lido, rotacionado ou publicado. Histórico completo e produção não foram certificados como livres de segredos.
