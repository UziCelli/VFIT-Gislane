# Inventário do catálogo de exercícios (etapa 1 do épico #255)

Etapa 1 da sub-issue #256. **Nada no app mudou.** São só tabelas para o Celli conferir.

## Arquivos

| Arquivo | O que tem |
|---|---|
| [inventario-atual.csv](inventario-atual.csv) | Os **359** exercícios de hoje, com nome proposto e atributos. Gerado por `python3 tools/catalogo-inventario.py`. |
| [exercicios-novos.csv](exercicios-novos.csv) | **614** exercícios novos, com as mesmas colunas (sem `nome_atual`/`status`/`duvida`; a coluna `observacao` traz as dúvidas). |

O GitHub mostra os CSV como tabela com busca. As colunas são: grupo, movimento-base, equipamento, mecanismo de carga (pinos, anilhas, livre, corporal, elástico), lateralidade, modo, unidade (reps ou tempo), pegada/variação e convenção de carga (total, por lado, corporal).

## Totais dos 359 atuais

- **200 iguais**: o nome já segue o padrão.
- **91 renomear**: só muda a ordem ou o termo do equipamento. O id **não muda**, e o nome antigo vira apelido.
- **68 a confirmar**: listados abaixo. Nada foi chutado.

Padrão usado: **Movimento + variação + equipamento**, igual ao da lista dos novos. Exemplos:

- Supino Reto Máquina → Supino Reto Máquina Seletora
- Rosca Direta Cabo → Rosca Direta Polia
- Crossover no Cabo → Crossover Duas Polias
- Puxada Articulada Cross → Puxada Cross Articulado
- Máquinas com nome próprio (Leg Press 45, Hack, Cadeira Extensora, Peck Deck) **não** ganham sufixo. O tipo aparece só na pílula.

## Decisões para o Celli

1. **"Halter" com carga por lado (29 exercícios).** Exemplos: Supino Reto Halter, Rosca Direta Halter, Elevação Lateral Halter. O app já anota a carga por lado, então a proposta é **Halteres**. Pode aplicar a todos?
2. **"Halter" sem pista (12).** Agachamento Livre, Terra Sumô, Elevação Pélvica, Pull Over, Rosca Scott, Tríceps Francês (em pé e sentado), Flexão de Joelhos deitado, Abdominal Oblíquo, Supinação, Pronação e Supinação e Pronação. É 1 ou 2 halteres?
3. **Sem equipamento no nome (10).** Remada Unilateral (serrote), Remada Cavalinho, Remada Isométrica, Panturrilha em Pé Unilateral, Panturrilha Sentado Unilateral, Elevação Lateral Inclinado, Elevação Lateral Isométrica, Rosca Isométrica a 90º, Tríceps Coice Apoiado e Stiff no Smith com Halter. Qual é o equipamento?
4. **Puxadas e remadas baixas sem equipamento (6).** Foram lidas como **Polia**. Confirma?
5. **"Guiada" (2).** Elevação Pélvica Máquina Guiada e Remada Linear 45º Guiada: é de pinos ou de anilhas?
6. **"Máquina" sem detalhe** foi lida como **Máquina Seletora** (pinos), como na lista dos novos. Confirma?
7. **Rótulo da articulada.** O plano diz **Articulado**, e a lista dos novos usa **Articulada**. Qual dos dois?
8. **Equipamentos próprios?** Caneleira, cinto de carga e bola de adução estão em "outro". Viram equipamentos próprios, como talvez o kettlebell?
9. **Repetição.** Box Jump e Box Jumps: são o mesmo exercício?
10. **Dúvidas da lista dos novos** (já no resumo): cerca de 18 linhas com possível repetição, e nomes que mudam de academia (Avanço/Passada/Afundo, Stiff/Terra Romeno...).

## O que fica para as próximas etapas

- **Etapa 2 (#257):** transformar estas colunas em campos do app. O nome passa a ser gerado pelos campos. Ids e apelidos são preservados.
- **Etapas 3 e 4 (#258, #259):** pílulas com ícones e cadastro manual no painel.
