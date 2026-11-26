# Inventário do catálogo de exercícios (etapa 1 do épico #255)

Etapa 1 da sub-issue #256. **Nada no app mudou.** São só tabelas para o Celli conferir.

## Arquivos

| Arquivo | O que tem |
|---|---|
| [inventario-atual.csv](inventario-atual.csv) | Os **359** exercícios de hoje, com nome proposto e atributos. Gerado por `python3 tools/catalogo-inventario.py`. |
| [exercicios-novos.csv](exercicios-novos.csv) | **645** exercícios novos (já com as decisões do Celli), com as mesmas colunas (sem `nome_atual`/`status`/`duvida`; a coluna `observacao` traz as dúvidas). |

O GitHub mostra os CSV como tabela com busca. As colunas são: grupo, movimento-base, equipamento, mecanismo de carga (pinos, anilhas, livre, corporal, elástico), lateralidade, modo, unidade (reps ou tempo), pegada/variação e convenção de carga (total, por lado, corporal).

## Totais dos 359 atuais

- **216 iguais**: o nome já segue o padrão.
- **141 renomear**: só muda a ordem ou o termo do equipamento. O id **não muda**, e o nome antigo vira apelido.
- **0 a confirmar**: o Celli respondeu os 13 em 26/11 (ver abaixo).
- **2 excluídos**: Stiff no Smith com Halter e Remada Isométrica. Saem da busca, do catálogo e da lista de vídeos, mas o histórico de quem já usou continua ligado.

Padrão usado: **Movimento + variação + equipamento**, igual ao da lista dos novos. Exemplos:

- Supino Reto Halter → Supino Reto Halteres
- Rosca Scott Halter → continua Rosca Scott Halter (1 halter)
- Supino Reto Máquina → Supino Reto Máquina Seletora
- Rosca Direta Cabo → Rosca Direta Polia
- Crossover no Cabo → Crossover Duas Polias
- Máquinas com nome próprio (Leg Press 45, Hack, Cadeira Extensora, Puxada Frente) **não** ganham sufixo. O tipo aparece só na pílula.

## Respostas do Celli aos 13 (26/11/2026)

1. Agachamento Halter Banco → **1 halter**.
2. Elevação Pélvica Máquina Guiada → **Seletora**. A Articulada já existe à parte.
3. Remada Linear 45º Guiada → **Articulada**.
4. Stiff no Smith com Halter → **excluído** (carga seria a do halter).
5. Remada Unilateral (serrote) → **Halter**. Versão polia: Remada Unilateral em Pé Polia (lista dos novos).
6. Remada Cavalinho → **Barra**. **T-Bar Row = versão Articulada** (lista dos novos); deixou de ser apelido da de barra.
7. Remada Isométrica → **excluída**.
8. Panturrilha em Pé Unilateral → **Peso do corpo**. Versão Halter na lista dos novos.
9. Panturrilha Sentado Unilateral → **Articulada**.
10. Elevação Lateral Inclinado → **Elevação Lateral Banco Inclinado Halter**. Versão Polia adicionada à lista dos novos.
11. Elevação Lateral Isométrica → **Halteres**. Versão Elástico adicionada à lista dos novos.
12. Rosca Isométrica a 90º → "tanto faz": ficou **Halteres** (uso mais comum).
13. Tríceps Coice Apoiado → **Halter**. Versão polia: Tríceps Coice Polia (lista dos novos).

**Ainda em aberto:** cinto de carga e bola de adução continuam em "outro". Viram equipamentos próprios?

## Variantes novas que saem das respostas

Já entraram em [exercicios-novos.csv](exercicios-novos.csv): Agachamento Livre Halteres, Rosca Scott Halteres e Tríceps Francês em Pé/Sentado Halteres. Os ids atuais não mudam e mantêm o histórico.

## Já decidido pelo Celli (26/11/2026)

- **"Halter" com carga por lado = Halteres** (33 exercícios, como o Supino Reto). Isso vale também para Afundo, Avanço, Recuo e Búlgaro.
- **Pull Over, Agachamento Livre, Tríceps Francês e Rosca Scott "Halter"** usam 1 halter. A versão com 2 halteres vira exercício novo.
- Terra Sumô, Elevação Pélvica, Flexão de Joelhos deitado, Abdominal Oblíquo, Supinação e Pronação: **1 halter**. Isto é uma premissa, porque é o uso comum.
- **Puxadas e remadas baixas sem equipamento no nome = máquina seletora.** "Máquina" sem detalhe também é seletora.
- **Rótulo: Articulada** (máquina articulada), como na lista dos novos.
- **Box Jump e Box Jumps** são exercícios diferentes e continuam separados.
- **Remada Curvada Fechada, Pronada e Supinada = Barra** ("geralmente barra, mas existem os dois"). O nome ganha "Barra" e o antigo vira apelido. As versões com halteres são exercícios à parte.

- **Retrocesso vira Recuo.** O nome antigo fica como apelido.
- **Smith e Smith Dual** são equipamentos diferentes, porque o Dual tem os lados separados.
- **Caneleira** vira equipamento próprio. **Miniband** entra como elástico.
- **Kettlebell** (1) e **Kettlebells** (2) seguem a mesma lógica de Halter e Halteres.
- **Pull Over Cabo vira Pulldown Polia.** O nome antigo fica como apelido.
- **Remada Cavalinho** também atende por **T-Bar Row**.
- Ficam separados: Pull Over e Pulldown, Stiff e Terra Romeno, Crossover e Crucifixo.
- O grupo novo "Mobilidade e Core Funcional" vira **Alongamentos**, separado em estáticos e dinâmicos. Isso vale para a lista dos novos, que está sendo atualizada.

## O que fica para as próximas etapas

- **Etapa 2 (#257):** transformar estas colunas em campos do app. O nome passa a ser gerado pelos campos. Ids e apelidos são preservados.
- **Etapas 3 e 4 (#258, #259):** pílulas com ícones e cadastro manual no painel.

## Etapa 2a: atributos no app (sem mudança visível)

- `src/data/atributos.json` guarda os atributos de cada id: base do nome, equipamento, mecanismo, lateralidade, modo, unidade, convenção de carga e apelidos. Foi gerado uma vez com `python3 tools/catalogo-inventario.py --atributos`. A partir de agora, **ele é a fonte da verdade**.
- `src/data/catalogo.ts` gera o nome (base + rótulo do equipamento) e resolve qualquer nome conhecido (atual, novo ou apelido) para o mesmo id.
- Os testes (`src/data/catalogo.test.ts`) garantem três coisas: todo nome antigo acha o mesmo exercício, a carga por lado e a isometria continuam iguais às listas atuais, e nenhum nome aponta para dois exercícios.

## Etapa 2b: o app usa o nome novo

- **Busca do coach:** mostra o nome novo, mas também acha pelo nome antigo e pelos apelidos (ex.: "t-bar" acha Remada Cavalinho). O exercício escolhido é gravado com o nome novo.
- **Histórico sem quebra:** para a carga anterior, o RM pessoal, a evolução, os alertas, a progressão Físio e as orientações Físio, o nome antigo e o novo contam como o **mesmo exercício**. Para isso usam `chaveExercicio` e `nomeAtualizado`. Texto livre continua comparado como antes.
- **Por lado, isometria, anatomia, segmento e grupo** são lidos pelo catálogo, por qualquer nome conhecido.
- **Assistente de voz:** recebe os nomes novos, e nome antigo vira o novo.
- **Conector MCP:** continua oferecendo os nomes atuais, mas também aceita os novos e os apelidos. Sem isso, copiar um meso com nome novo seria recusado. Ainda não foi publicado; a mudança completa é a etapa 8 (#263).
- `doisLados.json` e `isometricos.json` ficam por enquanto. O teste garante que batem com os atributos, e o extrator da planilha ainda usa `isometricos.json`.

## Etapa 4: cadastro manual (#259)

- **Onde:** Guias → **Catálogo de exercícios** (`#/catalogo`, só coach). Busca por nome novo, antigo ou apelido, filtro por grupo e equipamento, e pílulas em cada item.
- **Adicionar exercício:** movimento (texto), grupo, equipamento (lista fechada), lados, carga anotada (total ou por lado) e excêntrico. O nome final e as pílulas aparecem antes de salvar.
- **Duplicata:** recusa o mesmo nome do catálogo (novo, antigo ou apelido) ou de outro já cadastrado, sem ligar para acento, caixa e espaço.
- **Onde fica:** `exerciciosProprios/{id}` no Firestore da marca (cada marca tem o próprio Firebase). Só o coach com 2º fator lê, cria e apaga. Não há edição: o nome é a identidade no histórico. O catálogo base e o extrator da planilha não são tocados.
- **Montagem do treino:** o cadastrado aparece na busca do exercício com a marca "Seu" e com pílulas.
- **Limites desta etapa:** isométrico novo fica para depois (o cronômetro só conhece os isométricos do catálogo base); o "2 lados" no treino continua sendo ligado no próprio exercício do treino; o aluno vê o nome, mas não as pílulas do cadastrado; o conector (IA) ainda não conhece os cadastrados (etapa 8, #263).
