# Arquitetura

## Visão geral e tecnologias

Força é uma PWA de treino offline, com painel do coach e aplicativo do aluno. React/TypeScript/Vite/Tailwind geram duas marcas: VFIT e Gislane. Firebase Hosting hospeda o app; Firebase Auth identifica usuários; Firestore armazena dados e aplica autorização.

## Estrutura e responsabilidades

- `src/engine/`: fórmulas e montagem de sessões, puras e testáveis.
- `src/lib/`: integração Firebase, acesso, sincronização e lógica compartilhada; `src/features/`: telas e fluxos.
- `marcas/vfit/` e `marcas/gislane/`: configuração, tema e recursos; conferir ambas quando mudar código comum.
- `push/`: Worker Cloudflare e Durable Objects para push e intermediação de IA. `conector/`: Worker MCP/OAuth separado, para VFIT; leitura nas concessões antigas e prescrição em desenvolvimento com consentimento e aprovação explícitos ([contrato](docs/conector-prescricao.md)).
- `tools/` e `.github/workflows/`: administração, backups, validação e publicação; `tests/`/`e2e/`: regras e fluxos.

## Fluxo de dados

1. Login no Firebase Auth identifica usuário; regras Firestore decidem papel, proprietário e acesso. Ocultar botão não autoriza nem protege dados.
2. O cliente lê/escreve via SDK Firestore com persistência IndexedDB e sincronização posterior. O motor calcula o treino localmente; preserve registros pendentes e compatibilidade de clientes antigos.
3. Push/IA passam pelo Worker, com verificação de identidade/autorização. Chaves privadas não entram no bundle. A montagem por voz permanece desligada por decisão de custo.
4. O conector usa OAuth e renova o token Firebase do coach para consultar Firestore sob as regras dele; não usa credencial administrativa para ignorá-las.
5. PR → revisão cruzada e CI → merge autorizado na main → workflows de publicação. Documentação não substitui as restrições do provedor.

## Crescimento e limites

- Reutilize o Graphify existente para localizar relações; não duplique seu inventário aqui. O código é a fonte do comportamento atual.
- Monitore leituras Firestore, consultas amplas, quotas dos Workers e custo de IA antes de ampliar funcionalidades.
- Cache offline implica dados já recebidos disponíveis sem rede; revogação imediata não é garantida. Não mover o motor ao servidor sem decisão sobre offline, custo e desempenho.
- Não implementar planos futuros por estarem documentados. Pesquisas e pendências estão no [índice](docs/README.md); segurança em [SECURITY.md](SECURITY.md).
