# Segurança

Propósito: proteger identidade, dados de treino/saúde, segredos, disponibilidade e publicação. Este resumo orienta alterações; não certifica configurações de produção.

## Núcleos, autenticação e autorização

- Autoridades: Firebase Auth, `firestore.rules`, Workers em `push/` e `conector/`, workflows e cache local.
- Papel, proprietário, pagamento/status e MFA do coach devem ser conferidos no servidor/regras; nunca confiar em IDs ou botões do cliente. Manter isolamento entre usuários e marcas.
- Conector MCP usa a identidade do coach. Concessões antigas são somente leitura; prescrição em desenvolvimento exige novo consentimento e aprovação explícita com MFA antes de gravar. Não ampliar permissões nem introduzir acesso administrativo implícito. Ver [prescrição](docs/conector-prescricao.md).

## Ambientes e segredos

- Nunca commitar/logar tokens, chaves privadas, credenciais administrativas ou dados reais. Configuração web pública do Firebase não é credencial administrativa.
- IA usa segredo no Durable Object, não no navegador; voz está desligada. Não reativar por conveniência.
- Jobs privilegiados restringem branch à main, mas YAML não protege sozinho segredos contra colaborador malicioso. GitHub Environment restrito, Rulesets, IAM e MFA das contas dependem de confirmação no provedor: **não verificados por este guia**.
- Instalar dependências de jobs privilegiados sem credencial no ambiente e com lockfile; usar `--ignore-scripts` onde já exigido. Nunca ampliar exposição do segredo.

## Proteção de dados

- Não perder cargas pendentes: saída sincroniza e limpa cache coordenando abas. Offline não garante revogação imediata de dados já baixados.
- Saúde, anamnese e relatos de dor nunca vão para logs, push ou relatórios públicos. Preservar consentimento, exclusão LGPD, retenção e backup cifrado.
- Manter alertas clínicos, pré-requisitos e encaminhamento; não transformar restrição de saúde em mero detalhe visual.
- Dados malformados não podem derrubar telas; preservar limites de abuso/logs e validação defensiva.

## API, backend, dependências e infraestrutura

- Verificar tokens, projeto, papel/MFA; validar corpo/tamanho, limitar abuso e manter respostas privadas sem cache. CORS/App Check não substituem autorização.
- Preservar CSP, barreira de artefatos do build e scanners. Revisar lockfile e alertas, incluindo ferramentas do pipeline; não ampliar exceções de scanner para silenciar achados.
- Testar mudanças de regras no emulador com acesso negado e isolamento; nunca testar ataques ou restauração no banco real.

- App Check do conector usa debug token secreto; não substitui o token Firebase/MFA e as regras. Configuração e rotação: [guia operacional](docs/seguranca.md).

## Incidentes e pendências

- Suspeita de vazamento: conter, revogar/rotacionar credencial, revisar acessos, corrigir e validar. Registrar data, impacto, ação, responsável e evidência sem valores secretos ou dados pessoais; detalhes sensíveis em canal privado.
- Reportar vulnerabilidade sensível pelo recurso privado do GitHub, se habilitado; caso contrário, contatar o proprietário por canal privado. Não abrir Issue pública com segredo ou exploração sensível.
- [Plano de remediação](docs/security/REMEDIATION_PLAN.md), [ameaças](docs/security/THREAT_MODEL.md), [auditoria](docs/security/SECURITY_AUDIT.md) e [validação](docs/security/VALIDATION.md) contêm evidências datadas e pendências externas. Ausência de achado não comprova ausência de vulnerabilidade.
