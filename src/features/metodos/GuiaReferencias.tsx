import type { ReactNode } from 'react'
import { Cartao } from '../../ui'

const Titulo = ({ children }: { children: ReactNode }) => <h2 className="mb-2 font-semibold">{children}</h2>
const Fonte = ({ children }: { children: ReactNode }) => <li className="text-slate-300">{children}</li>
const link = 'text-marca-300 underline'

// Aba Consultas > Referências: de onde vêm os números que o app calcula. Texto fixo; a regra de cada cálculo mora em
// docs/estimativa-rm.md e docs/peso-corporal.md. Só entra aqui o que tem fonte conferida.
export default function GuiaReferencias() {
  return (
    <div>
      <h1 className="mb-3 text-lg font-bold">Referências</h1>
      <div className="space-y-3 text-sm">
        <Cartao>
          <Titulo>Carga sugerida pelas repetições (RM)</Titulo>
          <p className="mb-2">
            O número cinza do treino pode ser ajustado às repetições do dia. O app estima o 1RM (a carga máxima de 1 repetição) a partir da série anotada, com uma tabela de quantas repetições se faz em cada
            porcentagem do 1RM, e converte para as repetições de hoje. Com histórico suficiente, aprende quanto o aluno rende a mais ou a menos que a média, sempre presa a no máximo −12% / +8% da tabela.
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li>Vale para séries de até 15 repetições (o erro típico sobe de uns ±5% até 8 reps para uns ±10% perto de 15).</li>
            <li>A tabela vale para série até a falha. Série parada antes subestima o 1RM, e a sugestão sai um pouco leve.</li>
            <li>Não ajusta peso do corpo, exercício de 2 lados, isometria nem drops.</li>
            <li>Sexo, idade e nível de treino pouco mudam a relação, segundo a meta-análise; os dados são, na maioria, de adultos saudáveis de 20 a 40 anos.</li>
          </ul>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>
              Nuzzo JL, Pinto MD, Nosaka K, Steele J. Maximal number of repetitions at percentages of the one repetition maximum: a meta-regression and moderator analysis of sex, age, training status, and exercise. Sports
              Med. 2024;54(2):303-321.{' '}
              <a className={link} href="https://doi.org/10.1007/s40279-023-01937-7" target="_blank" rel="noreferrer">
                doi:10.1007/s40279-023-01937-7
              </a>
            </Fonte>
            <Fonte>
              Reynolds JM, Gordon TJ, Robergs RA. Prediction of one repetition maximum strength from multiple repetition maximum testing and anthropometry. J Strength Cond Res. 2006;20(3):584-592.{' '}
              <a className={link} href="https://doi.org/10.1519/R-15304.1" target="_blank" rel="noreferrer">
                doi:10.1519/R-15304.1
              </a>
            </Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>% de gordura: equações por perfil (avaliação física)</Titulo>
          <p className="mb-2">
            Cada equação de dobras vale para a população em que foi validada; fora dela o erro cresce. O coach pode escolher a equação ou deixar o app escolher pelo perfil, entre as que têm as dobras medidas:
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li><strong>Menos de 18 anos:</strong> Slaughter (tríceps + panturrilha).</li>
            <li><strong>Acima de 61 anos (homens) ou 55 (mulheres), ou IMC de 30 ou mais:</strong> Durnin &amp; Womersley (bíceps, tríceps, subescapular, supra-ilíaca), validada de 16 a 72 anos e de magros a obesos.</li>
            <li><strong>Adultos na faixa:</strong> Jackson &amp; Pollock de 7 dobras; com só 3 dobras, a versão de 3.</li>
          </ul>
          <p className="mb-2">
            A densidade vira % de gordura pela equação de Siri: <strong>%G = (4,95 ÷ densidade − 4,5) × 100</strong>. Sem dobras, vale a bioimpedância. Avaliações com equações diferentes não são comparadas. Em atletas e em
            pessoas com obesidade, as equações generalizadas erram mais.
          </p>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>Jackson AS, Pollock ML. Generalized equations for predicting body density of men. Br J Nutr. 1978;40(3):497-504.</Fonte>
            <Fonte>Jackson AS, Pollock ML, Ward A. Generalized equations for predicting body density of women. Med Sci Sports Exerc. 1980;12(3):175-181.</Fonte>
            <Fonte>Jackson AS, Pollock ML. Steps toward the development of generalized equations for predicting body composition of adults. Can J Appl Sport Sci. 1982;7(3):189-196.</Fonte>
            <Fonte>
              Durnin JV, Womersley J. Body fat assessed from total body density and its estimation from skinfold thickness: measurements on 481 men and women aged from 16 to 72 years. Br J Nutr. 1974;32(1):77-97.{' '}
              <a className={link} href="https://doi.org/10.1079/bjn19740060" target="_blank" rel="noreferrer">doi:10.1079/bjn19740060</a>
            </Fonte>
            <Fonte>Slaughter MH, Lohman TG, Boileau RA et al. Skinfold equations for estimation of body fatness in children and youth. Hum Biol. 1988;60(5):709-723.</Fonte>
            <Fonte>
              Withers RT, Craig NP, Bourdon PC, Norton KI. Relative body fat and anthropometric prediction of body density of male athletes. Eur J Appl Physiol. 1987;56(2):191-200 (equações publicadas erram em atletas).{' '}
              <a className={link} href="https://doi.org/10.1007/BF00640643" target="_blank" rel="noreferrer">doi:10.1007/BF00640643</a>
            </Fonte>
            <Fonte>
              Thompson DL, Snead DB, Weltman A. The utility of generalized girth and skinfold equations to predict body composition in women runners. Am J Hum Biol. 1993;5(3):283-290.{' '}
              <a className={link} href="https://doi.org/10.1002/ajhb.1310050306" target="_blank" rel="noreferrer">doi:10.1002/ajhb.1310050306</a>
            </Fonte>
            <Fonte>Siri WE. Body composition from fluid spaces and density: analysis of methods. In: Brozek J, Henschel A, eds. Techniques for Measuring Body Composition. Washington: National Academy of Sciences; 1961. p. 223-244.</Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>Erro técnico de medição (ETM)</Titulo>
          <p className="mb-2">
            Cada ponto pode ser medido 2 vezes; vale a média. Com os pares de todas as avaliações do aluno, o app calcula <strong>ETM = √(Σd² ÷ 2n)</strong> e o ETM% (ETM ÷ média × 100). Tolerância: até 5% nas dobras e
            1% nos perímetros; se as 2 medidas de um ponto passam disso, o app pede a 3ª. Com 5 pares ou mais, a <strong>menor mudança real (95%) = 1,96 × √2 × ETM</strong> vira o limiar das setas e leituras: abaixo
            dele, a variação é tratada como erro de medida.
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li>As regras são estatísticas (repetibilidade); as tolerâncias seguem a referência da ISAK citada na revisão abaixo.</li>
            <li>Entre avaliadores diferentes o erro das dobras é bem maior (2 a 5 mm contra menos de 1 mm do mesmo avaliador): prefira o mesmo avaliador.</li>
          </ul>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>
              Ulijaszek SJ, Kerr DA. Anthropometric measurement error and the assessment of nutritional status. Br J Nutr. 1999;82(3):165-177.{' '}
              <a className={link} href="https://doi.org/10.1017/s0007114599001348" target="_blank" rel="noreferrer">doi:10.1017/s0007114599001348</a>
            </Fonte>
            <Fonte>
              Adams C, Burke V, Beilin LJ. Accuracy of blood pressure measurement and anthropometry among volunteer observers in a large community survey. J Clin Epidemiol. 2002;55(4):338-344.{' '}
              <a className={link} href="https://doi.org/10.1016/s0895-4356(01)00492-9" target="_blank" rel="noreferrer">doi:10.1016/s0895-4356(01)00492-9</a>
            </Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>Anamnese</Titulo>
          <p className="mb-2">
            As perguntas de prontidão seguem o PAR-Q (com versão brasileira validada do PAR-Q+). A triagem do ACSM acrescenta o que mais muda o risco: se a pessoa já é ativa, se tem doença do coração, metabólica ou
            dos rins e se sente sinais ao esforço. Sinal ao esforço aparece para o coach como ponto de atenção, para pedir liberação médica antes de subir a intensidade. Nível de evidência: alto (diretriz e validação).
          </p>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>
              Schwartz J, Oh P, Takito MY, Saunders B et al. Translation, cultural adaptation, and reproducibility of the PAR-Q+: the Brazilian Portuguese version. Front Cardiovasc Med. 2021;8:712696.{' '}
              <a className={link} href="https://doi.org/10.3389/fcvm.2021.712696" target="_blank" rel="noreferrer">doi:10.3389/fcvm.2021.712696</a>
            </Fonte>
            <Fonte>
              Riebe D, Franklin BA, Thompson PD et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc. 2015;47(11):2473-2479.{' '}
              <a className={link} href="https://doi.org/10.1249/MSS.0000000000000664" target="_blank" rel="noreferrer">doi:10.1249/MSS.0000000000000664</a>
            </Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>Sugestão de esqueleto do treino (anamnese)</Titulo>
          <p className="mb-2">
            Com as respostas da anamnese, o app sugere ao coach a divisão pelos dias disponíveis, as séries por semana de cada grupo (6 a 10 para iniciantes, 10 a 14 intermediários, 12 a 20 avançados; regiões
            priorizadas no topo), as repetições pelo objetivo e a distância da falha. O volume é cortado para caber no tempo do treino. Dores, sinais ao esforço e doenças viram cuidados.
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li>Nível de evidência: moderado para as doses (meta-análises, a maioria com homens jovens).</li>
            <li>A combinação das regras é decisão do app, não foi validada: é ponto de partida, e o coach decide.</li>
          </ul>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>
              Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci. 2017;35(11):1073-1082.{' '}
              <a className={link} href="https://doi.org/10.1080/02640414.2016.1210197" target="_blank" rel="noreferrer">doi:10.1080/02640414.2016.1210197</a>
            </Fonte>
            <Fonte>
              Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? J Sports Sci. 2019;37(11):1286-1295.{' '}
              <a className={link} href="https://doi.org/10.1080/02640414.2018.1555906" target="_blank" rel="noreferrer">doi:10.1080/02640414.2018.1555906</a>
            </Fonte>
            <Fonte>
              Pelland JC, Remmert JF, Robinson ZP et al. The resistance training dose response: meta-regressions exploring the effects of weekly volume and frequency. Sports Med. 2026;56(2):481-505.{' '}
              <a className={link} href="https://doi.org/10.1007/s40279-025-02344-w" target="_blank" rel="noreferrer">doi:10.1007/s40279-025-02344-w</a>
            </Fonte>
            <Fonte>
              Robinson ZP, Pelland JC, Remmert JF et al. Exploring the dose-response relationship between estimated resistance training proximity to failure, strength gain, and muscle hypertrophy. Sports Med. 2024;54(9):2209-2231.{' '}
              <a className={link} href="https://doi.org/10.1007/s40279-024-02069-2" target="_blank" rel="noreferrer">doi:10.1007/s40279-024-02069-2</a>
            </Fonte>
            <Fonte>
              Bull FC, Al-Ansari SS, Biddle S et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med. 2020;54(24):1451-1462 (aeróbico semanal).{' '}
              <a className={link} href="https://doi.org/10.1136/bjsports-2020-102955" target="_blank" rel="noreferrer">doi:10.1136/bjsports-2020-102955</a>
            </Fonte>
            <Fonte>
              Hayden JA, Ellis J, Ogilvie R et al. Exercise therapy for chronic low back pain. Cochrane Database Syst Rev. 2021;9:CD009790.{' '}
              <a className={link} href="https://doi.org/10.1002/14651858.CD009790.pub2" target="_blank" rel="noreferrer">doi:10.1002/14651858.CD009790.pub2</a>
            </Fonte>
            <Fonte>
              Silbernagel KG, Thomeé R, Eriksson BI, Karlsson J. Continued sports activity, using a pain-monitoring model, during rehabilitation in patients with Achilles tendinopathy. Am J Sports Med. 2007;35(6):897-906.{' '}
              <a className={link} href="https://doi.org/10.1177/0363546506298279" target="_blank" rel="noreferrer">doi:10.1177/0363546506298279</a>
            </Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>Leitura do período: carga, dor e medida</Titulo>
          <p className="mb-2">
            Na avaliação, o coach vê por segmento a carga, a frequência de treino, os relatos de dor e a medida entre duas avaliações, com uma frase de leitura. <strong>São inferências interpretativas sobre o
            histórico, não causa e efeito</strong>: não há estudo que ligue, na mesma pessoa, carga ou dor à mudança de perímetro, e força e tamanho do músculo quase não andam juntos no indivíduo. Tórax, cintura e
            abdômen usam limiar de 1 cm (os demais, 0,5 cm), porque oscilam mais por gordura e líquido.
          </p>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>
              Lees MJ, Mcleod JC, Morton RW et al. Resistance training load does not determine resistance training-induced hypertrophy across upper and lower limbs in healthy young males. J Physiol. 2025.{' '}
              <a className={link} href="https://doi.org/10.1113/JP289684" target="_blank" rel="noreferrer">doi:10.1113/JP289684</a>
            </Fonte>
            <Fonte>
              Ulijaszek SJ, Kerr DA. Anthropometric measurement error and the assessment of nutritional status. Br J Nutr. 1999;82(3):165-177.{' '}
              <a className={link} href="https://doi.org/10.1017/s0007114599001348" target="_blank" rel="noreferrer">doi:10.1017/s0007114599001348</a>
            </Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>Peso do corpo nos exercícios</Titulo>
          <p className="mb-2">
            Em exercícios em que o corpo é a carga, o app soma ao que o aluno digita uma fração do peso corporal (por exemplo, 64% na flexão de braços). Os valores vêm da massa dos segmentos corporais e de estudos de força em flexões.
            <strong> Os valores de abdominais, isométricos e variações estão em revisão</strong> e podem mudar.
          </p>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>Winter DA. Biomechanics and Motor Control of Human Movement. 4th ed. Hoboken: Wiley; 2009 (massa dos segmentos).</Fonte>
            <Fonte>Ebben WP et al. Kinetic analysis of several variations of push-ups. J Strength Cond Res. 2011 (flexões).</Fonte>
          </ul>
        </Cartao>
      </div>
    </div>
  )
}
