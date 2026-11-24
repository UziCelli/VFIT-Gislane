# Evidências: ampliação da avaliação física, anamnese e sugestões

Revisão feita em 24/11/2026 (busca no PubMed), antes de implementar. Pedido do dono: buscar validade e limitações,
graduar a evidência, ficar com o que chega a nível **moderado** e, onde não houver evidência de causa, aplicar como
**inferência interpretativa** (com aviso no app de que não é causa e efeito).

Níveis usados (simplificado, estilo GRADE): **alto** = diretriz/consenso ou meta-análise consistente; **moderado** =
meta-análise com limitações ou estudos de validação contra imagem (MRI, TC, pQCT); **baixo** = estudos transversais
pequenos ou populações diferentes; **sem evidência de causa** = nada liga diretamente as variáveis no indivíduo.

| # | Pedido | Nível | Como entra no app |
|---|---|---|---|
| 1 | Dobras de um lado valendo para os dois (simetria) | Baixo a moderado | Perímetro corrigido nos dois lados com a dobra da direita; braço esquerdo marcado; lipedema exclui |
| 2 | Anamnese ampliada | Alto | Perguntas no padrão PAR-Q+ e triagem ACSM |
| 3 | Esqueleto do treino pela anamnese | Moderado (para as doses); algoritmo não validado | Sugestão editável, com as regras explicadas |
| 4 | Oscilações de carga, frequência e dor × perímetros | Sem evidência de causa | Inferência interpretativa, com aviso; limiar maior em tórax, cintura e abdômen |
| 5 | Áreas musculares (coxa, braço, corpo) | Moderado | Estimativa para tendência, com limites na aba Referências |

## 1. Simetria das dobras

- Moreno et al., 2002 (crianças, n = 164): diferença entre lados menor que o erro técnico de medida; % de gordura igual
  pelos dois lados. [doi:10.1038/sj.ejcn.1601493](https://doi.org/10.1038/sj.ejcn.1601493)
- Malina & Buschang, 1984 (homens adultos): assimetria maior nos membros superiores; pequena nos inferiores.
  [doi:10.1080/03014468400007431](https://doi.org/10.1080/03014468400007431)
- Lipedema: deposição desproporcional, diretriz S2k 2024. [doi:10.1111/ddg.15513](https://doi.org/10.1111/ddg.15513)

**Limite:** poucos estudos em adultos treinados. Nos braços, a dominância pode pesar. **Uso:** dobras do lado direito
(protocolo), aplicadas aos dois lados; região com lipedema fica sem estimativa.

## 2. Anamnese

- PAR-Q+ versão brasileira, reprodutibilidade verificada (Schwartz et al., 2021).
  [doi:10.3389/fcvm.2021.712696](https://doi.org/10.3389/fcvm.2021.712696)
- ACSM, triagem pré-participação (Riebe et al., 2015): nível de atividade atual, sinais/sintomas ou doença
  cardiovascular, metabólica ou renal, e intensidade desejada. [doi:10.1249/MSS.0000000000000664](https://doi.org/10.1249/MSS.0000000000000664)

## 3. Esqueleto do treino

- Volume: relação dose-resposta com hipertrofia (Schoenfeld et al., 2017). [doi:10.1080/02640414.2016.1210197](https://doi.org/10.1080/02640414.2016.1210197)
- Volume e frequência, meta-regressões com retornos decrescentes (Pelland et al., 2026). [doi:10.1007/s40279-025-02344-w](https://doi.org/10.1007/s40279-025-02344-w)
- Frequência com volume igualado: diferença pequena (Schoenfeld et al., 2019). [doi:10.1080/02640414.2018.1555906](https://doi.org/10.1080/02640414.2018.1555906)
- Proximidade da falha (Robinson et al., 2024). [doi:10.1007/s40279-024-02069-2](https://doi.org/10.1007/s40279-024-02069-2)

- Aeróbico: 150 min/semana moderado ou 75 min vigoroso (OMS 2020). [doi:10.1136/bjsports-2020-102955](https://doi.org/10.1136/bjsports-2020-102955)

Cálculo: `src/lib/esqueletoTreino.ts` (cartão na anamnese do coach).

**Limite:** amostras na maioria de homens jovens; o algoritmo que junta as respostas é decisão de projeto, não validado.

## 4. Oscilações × dor × perímetros

- Ganho de tamanho e de força quase não compartilham variância no indivíduo (Lees et al., 2025).
  [doi:10.1113/JP289684](https://doi.org/10.1113/JP289684)
- Exercício reduz dor lombar crônica, certeza moderada (Hayden et al., Cochrane 2021).
  [doi:10.1002/14651858.CD009790.pub2](https://doi.org/10.1002/14651858.CD009790.pub2)
- Modelo de monitoramento da dor permitiu seguir treinando sem prejuízo (Silbernagel et al., 2007, ECR, tendinopatia).
  [doi:10.1177/0363546506298279](https://doi.org/10.1177/0363546506298279)
- Erro de medida antropométrica (Ulijaszek & Kerr, 1999). [doi:10.1017/s0007114599001348](https://doi.org/10.1017/s0007114599001348)
- Redução localizada de gordura: resultados conflitantes, estudos pequenos (Brobakken et al., 2023;
  Paoli et al., 2021). [doi:10.14814/phy2.15853](https://doi.org/10.14814/phy2.15853) · [doi:10.3390/ijerph18073845](https://doi.org/10.3390/ijerph18073845)

**Conclusão:** nenhuma evidência liga, de forma causal, oscilação de carga ou dor à mudança de perímetro de um segmento.
Entra como inferência interpretativa. Tórax, cintura e abdômen oscilam mais (gordura e líquido): limiar maior e leitura
mais cautelosa.

Cálculo: `src/lib/oscilacoes.ts` (cartão "Leitura do período", só o coach vê, pois usa relato de dor). Limiar do
tronco (tórax, cintura, abdômen) de 1 cm também no relatório (`LIMIAR_TRONCO_CM`).

## 5. Áreas musculares

- Coxa: Housh et al., 1995 (MRI; erro de 10 a 25 cm² na área total); Knapik et al., 1996 (MRI, r = 0,96, mas
  superestima). [doi:10.1097/00005768-199612000-00013](https://doi.org/10.1097/00005768-199612000-00013)
- Mudança com treino: as equações de campo subestimam o absoluto, mas seguem o padrão da pQCT (DeFreitas et al., 2010).
  [doi:10.1519/JSC.0b013e3181ec86f3](https://doi.org/10.1519/JSC.0b013e3181ec86f3)
- Braço sem osso: Heymsfield et al., 1982 (TC; erro individual de 7 a 8%). [doi:10.1093/ajcn/36.4.680](https://doi.org/10.1093/ajcn/36.4.680)
- Massa muscular total: Lee et al., 2000 (MRI; R² 0,91; erro padrão 2,2 kg; só IMC < 30).
  [doi:10.1093/ajcn/72.3.796](https://doi.org/10.1093/ajcn/72.3.796)

Cálculo: `src/lib/areaMuscular.ts`. Texto para o usuário: aba Consultas › Referências.

## 6. Equações de dobras por perfil e ETM (pedido do dono, 24/11/2026)

Nível: **moderado** para a escolha por população (validação de cada equação e estudos de validação cruzada);
as regras de ETM são **estatísticas** (repetibilidade), com tolerâncias de referência.

- Equações generalizadas valem na faixa de idade e adiposidade de origem (Jackson & Pollock, 1982); erram mais
  em atletas (Withers et al., 1987, [doi:10.1007/BF00640643](https://doi.org/10.1007/BF00640643)) e em corredoras
  (Thompson et al., 1993, [doi:10.1002/ajhb.1310050306](https://doi.org/10.1002/ajhb.1310050306)).
- Durnin & Womersley, 1974: 16 a 72 anos, magros a obesos. [doi:10.1079/bjn19740060](https://doi.org/10.1079/bjn19740060)
- Slaughter et al., 1988: 8 a 18 anos.
- ETM e tolerâncias (dobras 5%, perímetros 1%, intra-avaliador): Ulijaszek & Kerr, 1999.
  [doi:10.1017/s0007114599001348](https://doi.org/10.1017/s0007114599001348)
- Erro entre avaliadores muito maior que dentro do mesmo avaliador (dobras 2,1 a 5,4 mm × 0,6 a 1,0 mm):
  Adams et al., 2002. [doi:10.1016/s0895-4356(01)00492-9](https://doi.org/10.1016/s0895-4356(01)00492-9)

Escolha automática (`src/lib/equacoesDobras.ts`): menor de 18 → Slaughter; acima de 61 (H) / 55 (M) ou IMC ≥ 30 →
Durnin & Womersley; senão Pollock 7 (ou 3). O coach pode fixar outra. ETM (`src/lib/etm.ts`): 2 medidas por ponto,
média; ETM = √(Σd²/2n) com os pares do aluno; com ≥ 5 pares, menor mudança real = 1,96 × √2 × ETM vira o limiar.
