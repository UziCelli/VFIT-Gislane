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
