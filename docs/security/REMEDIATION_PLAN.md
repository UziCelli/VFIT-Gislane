# Plano priorizado

Implementado nesta branch: limites de bytes no Worker, no-store, redução CSP, cache do script importado, barreira de artefatos e configuração Dependabot. Nenhum deploy, migração, segredo ou configuração de conta alterado. Rollback: reverter commit da entrega e repetir validação; dados/formato de documentos permanecem iguais.

## P0 — responsável: proprietário/administrador

1. GitHub → Settings → Environments: criar ambiente de produção limitado à main e revisar quem aprova. Migrar credenciais pelo gerenciador de segredos, sem copiá-las no chat; só depois vincular jobs ao ambiente e remover versões de escopo repositório. Aceite: branch de trabalho não recebe credencial mesmo alterando YAML. Coordenar todos os workflows para não interromper manutenção/deploy.
2. GitHub → Rulesets: proteger main, exigir PR/revisão cruzada e CI, bloquear force push e exclusão, limitar bypass. Aceite: colaborador sem bypass não publica diretamente. Revisão Claude exigida por [AGENTS.md](../../AGENTS.md) antes de juntar esta entrega.
3. Conferir MFA Google/GitHub/Cloudflare/registrador, recuperação e IAM mínimo, projetos separados quando viável. Aceite: inventário de acessos e teste de recuperação sem dados reais expostos.
4. Caso apareça segredo real: revogar/rotacionar primeiro, revisar acessos e somente depois tratar histórico. Esta auditoria não comprovou segredo ativo exposto.

## P1 — responsável: proprietário + agente técnico

- App Check: Firebase → App Check, nas duas marcas, conferir métricas em Monitorar; habilitar Aplicar somente após confirmar versões válidas e capacidade de recuperação. Conferir senha mínima e restrições de API/domínios. Aceite: cliente legítimo funciona e requisição sem atestado é recusada quando exigido.
- Testar restauração de backup cifrado em ambiente isolado; guardar senha no gerenciador; registrar RPO/RTO e retenção. Nunca testar sobre banco real.
- Repositórios públicos: decidir manter por custo Actions ou tornar privados em Settings → General → Danger Zone. Git público anterior já pode ter cópias; privacidade não substitui segurança do backend.
- Dependências: revisar alertas e lockfile; gerar SBOM (`npm sbom --sbom-format cyclonedx`) em ambiente controlado; Gitleaks foi executado e configurado em CI: 32 alertas históricos classificados; 6 fingerprints exatos e exclusão do cache gerado Graphify conforme revisão Claude; revisar qualquer novo alerta e não armazenar segredos nessa pasta; SAST continua pendente. Não publicar relatórios que contenham credenciais. Ferramentas de build também podem afetar o pipeline.
- Revisar necessidade e proteção dos dados de saúde offline; assinar decisão de risco. Não prometer apagar cópias do usuário após cancelamento.
- Titularidade/licenças: seguir `IP_AND_LICENSING.md`; revisão jurídica antes de impor licença proprietária ao conjunto.

## P2 — responsável: agente técnico + proprietário

- Pinning de Actions por SHA revisado e política de atualização; SBOM/atestação e alertas de deploy.
- Testes de update/rollback do SW em staging e revisão de cache de acesso Worker (revogação tem atraso documentado).
- Monitoramento de quota, cadastro, abuso e domínio; rate limits persistentes conforme necessidade observada. WAF/CDN conforme hospedagem, sem bloquear acessibilidade.
- Se o motor precisar ser segredo comercial, desenhar backend e custo mantendo decisão explícita sobre offline. Ofuscação/F12 não resolvem.

Critério de entrega desta branch: validação registrada em `VALIDATION.md`, revisão de diff pelo responsável e revisão cruzada Claude; console e produção permanecem pendentes até evidência direta. Não alegar checklist global concluído.
