import type { ReactNode } from 'react'
import { Cartao } from '../../ui'
import { BotaoVoltar } from '../../voltar'
import SeletorGuia from './SeletorGuia'

const Titulo = ({ children }: { children: ReactNode }) => <h2 className="mb-2 font-semibold">{children}</h2>
const Fonte = ({ children }: { children: ReactNode }) => <li className="text-slate-300">{children}</li>
const link = 'text-marca-300 underline'

// Aba Consultas > Referências: de onde vêm os números que o app calcula. Texto fixo; a regra de cada cálculo mora em
// docs/estimativa-rm.md e docs/peso-corporal.md. Só entra aqui o que tem fonte conferida.
export default function GuiaReferencias() {
  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <BotaoVoltar para="/" />
      <h1 className="mb-3 text-lg font-bold">Referências</h1>
      <SeletorGuia ativo="referencias" />
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
          <Titulo>% de gordura (avaliação física)</Titulo>
          <p className="mb-2">
            Pelas 7 dobras cutâneas (peitoral, axilar média, tríceps, subescapular, abdominal, supra-ilíaca e coxa), que precisam de sexo e idade: a soma das dobras dá a densidade corporal (equação de Jackson &amp; Pollock para
            homens; Jackson, Pollock &amp; Ward para mulheres) e a densidade vira % de gordura pela equação de Siri: <strong>%G = (4,95 ÷ densidade − 4,5) × 100</strong>. Sem as dobras, vale o % da bioimpedância, e o app avisa a
            fonte usada.
          </p>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>Jackson AS, Pollock ML. Generalized equations for predicting body density of men. Br J Nutr. 1978;40(3):497-504.</Fonte>
            <Fonte>Jackson AS, Pollock ML, Ward A. Generalized equations for predicting body density of women. Med Sci Sports Exerc. 1980;12(3):175-181.</Fonte>
            <Fonte>Siri WE. Body composition from fluid spaces and density: analysis of methods. In: Brozek J, Henschel A, eds. Techniques for Measuring Body Composition. Washington: National Academy of Sciences; 1961. p. 223-244.</Fonte>
          </ul>
        </Cartao>

        <Cartao>
          <Titulo>Músculo estimado e dobras dos dois lados (avaliação física)</Titulo>
          <p className="mb-2">
            As dobras são medidas de um lado só (o direito) e valem para os dois, porque a gordura sob a pele costuma ser simétrica. Com elas, o app tira a gordura do perímetro:{' '}
            <strong>perímetro corrigido = perímetro − π × dobra</strong>. Daí saem a área muscular do braço (tríceps), a da coxa (dobra da coxa) e a massa muscular do corpo (braço, coxa e panturrilha).
          </p>
          <ul className="mb-2 list-disc space-y-1 pl-5">
            <li>Nos braços, a mão dominante pode deixar um lado maior; por isso o lado esquerdo vem marcado "dobra da direita".</li>
            <li>Com lipedema marcado na região, não há estimativa: a gordura não é simétrica nem representada pela dobra.</li>
            <li>A área da coxa superestima o valor absoluto, mas acompanha a mudança com o treino. Use para a tendência.</li>
            <li>A massa muscular do corpo só aparece com IMC abaixo de 30 e sem ajuste de etnia (o app não pergunta).</li>
            <li>Nível de evidência: moderado para as áreas musculares; baixo a moderado para a simetria das dobras.</li>
          </ul>
          <h3 className="mb-1 text-xs font-semibold uppercase text-slate-400">Fontes</h3>
          <ul className="list-disc space-y-1 pl-5">
            <Fonte>
              Heymsfield SB, McManus C, Smith J, Stevens V, Nixon DW. Anthropometric measurement of muscle mass: revised equations for calculating bone-free arm muscle area. Am J Clin Nutr. 1982;36(4):680-690.{' '}
              <a className={link} href="https://doi.org/10.1093/ajcn/36.4.680" target="_blank" rel="noreferrer">doi:10.1093/ajcn/36.4.680</a>
            </Fonte>
            <Fonte>
              Lee RC, Wang Z, Heo M, Ross R, Janssen I, Heymsfield SB. Total-body skeletal muscle mass: development and cross-validation of anthropometric prediction models. Am J Clin Nutr. 2000;72(3):796-803.{' '}
              <a className={link} href="https://doi.org/10.1093/ajcn/72.3.796" target="_blank" rel="noreferrer">doi:10.1093/ajcn/72.3.796</a>
            </Fonte>
            <Fonte>
              Knapik JJ, Staab JS, Harman EA. Validity of an anthropometric estimate of thigh muscle cross-sectional area. Med Sci Sports Exerc. 1996;28(12):1523-1530.{' '}
              <a className={link} href="https://doi.org/10.1097/00005768-199612000-00013" target="_blank" rel="noreferrer">doi:10.1097/00005768-199612000-00013</a>
            </Fonte>
            <Fonte>
              DeFreitas JM, Beck TW, Stock MS et al. A comparison of techniques for estimating training-induced changes in muscle cross-sectional area. J Strength Cond Res. 2010;24(9):2383-2389.{' '}
              <a className={link} href="https://doi.org/10.1519/JSC.0b013e3181ec86f3" target="_blank" rel="noreferrer">doi:10.1519/JSC.0b013e3181ec86f3</a>
            </Fonte>
            <Fonte>Housh DJ, Housh TJ, Weir JP et al. Anthropometric estimation of thigh muscle cross-sectional area. Med Sci Sports Exerc. 1995;27(5):784-791.</Fonte>
            <Fonte>
              Moreno LA, Rodríguez G, Guillén J et al. Anthropometric measurements in both sides of the body in the assessment of nutritional status in prepubertal children. Eur J Clin Nutr. 2002;56(12):1208-1215 (diferença entre lados menor que o erro de medida).{' '}
              <a className={link} href="https://doi.org/10.1038/sj.ejcn.1601493" target="_blank" rel="noreferrer">doi:10.1038/sj.ejcn.1601493</a>
            </Fonte>
            <Fonte>Malina RM, Buschang PH. Anthropometric asymmetry in normal and mentally retarded males. Ann Hum Biol. 1984;11(6):515-531 (assimetria maior nos braços que nas pernas).</Fonte>
            <Fonte>
              Faerber G et al. S2k guideline lipedema. J Dtsch Dermatol Ges. 2024;22(9):1303-1315.{' '}
              <a className={link} href="https://doi.org/10.1111/ddg.15513" target="_blank" rel="noreferrer">doi:10.1111/ddg.15513</a>
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
    </main>
  )
}
