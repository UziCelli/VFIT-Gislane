// Equações de % de gordura por dobras e a escolha da mais adequada ao perfil do aluno. Funções puras.
// Evidência e limites: docs/evidencias-avaliacao.md (seção "Equações e ETM") e aba Referências.
// Regra geral: equação generalizada vale dentro da população em que foi validada (idade, sexo, adiposidade);
// fora dela o erro cresce (Jackson & Pollock 1982; Withers 1987; Thompson 1993).
import type { Sexo } from './avaliacao'

export type DobraEq = 'peitoral' | 'axilar' | 'triceps' | 'subescapular' | 'abdominal' | 'suprailiaca' | 'coxa' | 'biceps' | 'panturrilha'
export type EquacaoId = 'jp7' | 'jp3' | 'dw' | 'slaughter'
export type Entrada = { sexo: Sexo; idade: number; dobras: Partial<Record<DobraEq, number>>; imc: number | null }

export const EQUACOES: Record<EquacaoId, { nome: string; curto: string; populacao: string }> = {
  jp7: { nome: 'Jackson & Pollock, 7 dobras', curto: 'Pollock 7', populacao: 'Adultos de 18 a 61 anos (homens) e 18 a 55 (mulheres), magros a moderados' },
  jp3: { nome: 'Jackson & Pollock, 3 dobras', curto: 'Pollock 3', populacao: 'Mesma população do Pollock 7, com menos dobras' },
  dw: { nome: 'Durnin & Womersley, 4 dobras', curto: 'Durnin & Womersley', populacao: 'Adultos de 16 a 72 anos, de magros a obesos' },
  slaughter: { nome: 'Slaughter et al., tríceps e panturrilha', curto: 'Slaughter', populacao: 'Crianças e adolescentes de 8 a 18 anos' },
}

const PRECISA: Record<EquacaoId, (s: Sexo) => DobraEq[]> = {
  jp7: () => ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
  jp3: (s) => (s === 'M' ? ['peitoral', 'abdominal', 'coxa'] : ['triceps', 'suprailiaca', 'coxa']),
  dw: () => ['biceps', 'triceps', 'subescapular', 'suprailiaca'],
  slaughter: () => ['triceps', 'panturrilha'],
}

export const temDobras = (eq: EquacaoId, e: Pick<Entrada, 'sexo' | 'dobras'>) => PRECISA[eq](e.sexo).every((d) => e.dobras[d] != null)
const soma = (eq: EquacaoId, e: Entrada) => PRECISA[eq](e.sexo).reduce((s, d) => s + e.dobras[d]!, 0)
const siri = (d: number) => (4.95 / d - 4.5) * 100

// Durnin & Womersley 1974: D = c − m × log10(soma), por sexo e faixa de idade.
const DW: Record<Sexo, [number, number, number][]> = {
  // [idade até, c, m]
  M: [[19, 1.162, 0.063], [29, 1.1631, 0.0632], [39, 1.1422, 0.0544], [49, 1.162, 0.07], [Infinity, 1.1715, 0.0779]],
  F: [[19, 1.1549, 0.0678], [29, 1.1599, 0.0717], [39, 1.1423, 0.0632], [49, 1.1333, 0.0612], [Infinity, 1.1339, 0.0645]],
}

// % de gordura pela equação (null sem as dobras ou com resultado fora de 0–70%).
export function gorduraPorEquacao(eq: EquacaoId, e: Entrada): number | null {
  if (!temDobras(eq, e)) return null
  const s = soma(eq, e)
  const m = e.sexo === 'M'
  let pct: number
  if (eq === 'jp7') pct = siri(m ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * e.idade : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * e.idade)
  else if (eq === 'jp3') pct = siri(m ? 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * e.idade : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * e.idade)
  else if (eq === 'dw') {
    const [, c, k] = DW[e.sexo].find(([ate]) => e.idade <= ate)!
    pct = siri(c - k * Math.log10(s))
  } else pct = m ? 0.735 * s + 1 : 0.61 * s + 5.1
  const r = Math.round(pct * 10) / 10
  return r > 0 && r < 70 ? r : null
}

// Escolha automática pelo perfil, só entre as equações com as dobras medidas. Devolve a escolhida e o motivo.
export function escolherEquacao(e: Entrada): { eq: EquacaoId; motivo: string } | null {
  const tem = (eq: EquacaoId) => temDobras(eq, e)
  const limiteJP = e.sexo === 'M' ? 61 : 55
  if (e.idade < 18) return tem('slaughter') ? { eq: 'slaughter', motivo: 'menor de 18 anos' } : null
  const foraJP = e.idade > limiteJP || (e.imc != null && e.imc >= 30)
  if (foraJP && tem('dw')) return { eq: 'dw', motivo: e.idade > limiteJP ? `acima de ${limiteJP} anos` : 'IMC de 30 ou mais' }
  if (tem('jp7')) return { eq: 'jp7', motivo: foraJP ? 'padrão (faltam as dobras de Durnin & Womersley)' : 'adulto na faixa validada' }
  if (tem('jp3')) return { eq: 'jp3', motivo: 'faltam dobras para o Pollock 7' }
  if (tem('dw')) return { eq: 'dw', motivo: 'faltam dobras para o Pollock' }
  return null
}
