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
- **128 renomear**: só muda a ordem ou o termo do equipamento. O id **não muda**, e o nome antigo vira apelido.
- **15 a confirmar**: listados abaixo. Nada foi chutado e nenhum deles bloqueia a etapa 2. Até a decisão, o equipamento fica vazio.

Padrão usado: **Movimento + variação + equipamento**, igual ao da lista dos novos. Exemplos:

- Supino Reto Halter → Supino Reto Halteres
- Rosca Scott Halter → continua Rosca Scott Halter (1 halter)
- Supino Reto Máquina → Supino Reto Máquina Seletora
- Rosca Direta Cabo → Rosca Direta Polia
- Crossover no Cabo → Crossover Duas Polias
- Máquinas com nome próprio (Leg Press 45, Hack, Cadeira Extensora, Puxada Frente) **não** ganham sufixo. O tipo aparece só na pílula.

## Ainda a confirmar (15)

1. **Sem equipamento no nome (10).** Remada Unilateral (serrote), Remada Cavalinho, Remada Isométrica, Panturrilha em Pé Unilateral, Panturrilha Sentado Unilateral, Elevação Lateral Inclinado, Elevação Lateral Isométrica, Rosca Isométrica a 90º, Tríceps Coice Apoiado e Stiff no Smith com Halter.
2. **"Guiada" (2).** Elevação Pélvica Máquina Guiada e Remada Linear 45º Guiada: é de pinos ou de anilhas?
3. **Agachamento Halter Banco:** é com 1 halter?
4. **Cinto de carga e bola de adução:** viram equipamentos próprios?
5. **Rótulo da articulada:** o plano diz **Articulado**, e a lista dos novos usa **Articulada**.

## Variantes novas que saem das respostas

Já entraram em [exercicios-novos.csv](exercicios-novos.csv): Agachamento Livre Halteres, Rosca Scott Halteres e Tríceps Francês em Pé/Sentado Halteres. Os ids atuais não mudam e mantêm o histórico.

## Já decidido pelo Celli (26/11/2026)

- **"Halter" com carga por lado = Halteres** (29 exercícios, como o Supino Reto).
- **Pull Over, Agachamento Livre, Tríceps Francês e Rosca Scott "Halter"** usam 1 halter. A versão com 2 halteres vira exercício novo.
- Terra Sumô, Elevação Pélvica, Flexão de Joelhos deitado, Abdominal Oblíquo, Supinação e Pronação: **1 halter**. Isto é uma premissa, porque é o uso comum.
- **Puxadas e remadas baixas sem equipamento no nome = máquina seletora.** "Máquina" sem detalhe também é seletora.
- **Box Jump e Box Jumps** são exercícios diferentes e continuam separados.

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
