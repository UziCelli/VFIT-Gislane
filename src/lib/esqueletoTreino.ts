// Esqueleto do treino a partir da anamnese: divisão, séries por semana de cada grupo, repetições e distância da falha.
// Função pura, só para o coach (nunca vai ao aluno, à IA nem ao log: parte de dado de saúde). É uma SUGESTÃO editável:
// as doses vêm de meta-análises (nível moderado), mas a combinação das regras é decisão de projeto, não validada.
// Evidências: docs/evidencias-avaliacao.md (item 3) e aba Referências.
import type { Respostas } from './anamnese'

export type Grupo = 'peito' | 'costas' | 'ombros' | 'bracos' | 'pernas' | 'gluteos' | 'abdomen'
export const ROTULO_GRUPO: Record<Grupo, string> = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', bracos: 'Braços', pernas: 'Pernas', gluteos: 'Glúteos', abdomen: 'Abdômen e core',
}
const GRUPOS = Object.keys(ROTULO_GRUPO) as Grupo[]

export type Dia = { nome: string; grupos: { grupo: Grupo; series: number }[] }
export type Esqueleto = {
  divisao: string
  dias: Dia[]
  seriesSemana: Record<Grupo, number>
  reps: string
  rir: string // repetições na reserva (distância da falha)
  aerobico: string | null
  cuidados: string[] // dores, sinais e condições
  regras: string[] // por que saiu assim (transparência para o coach)
}

const SUPERIOR: Grupo[] = ['peito', 'costas', 'ombros', 'bracos']
const INFERIOR: Grupo[] = ['pernas', 'gluteos', 'abdomen']
const EMPURRAR: Grupo[] = ['peito', 'ombros', 'bracos']
const PUXAR: Grupo[] = ['costas', 'bracos']

// Divisão pelos dias disponíveis. 7 dias vira 6 (um dia de descanso).
function divisao(dias: number): { nome: string; dias: { nome: string; grupos: Grupo[] }[] } {
  const d = (nome: string, grupos: Grupo[]) => ({ nome, grupos })
  if (dias <= 3) return { nome: `Corpo inteiro, ${dias}x por semana`, dias: Array.from({ length: dias }, (_, i) => d(`Treino ${i + 1}`, GRUPOS)) }
  if (dias === 4) return { nome: 'Superior / inferior, 2x cada', dias: [d('Superior A', SUPERIOR), d('Inferior A', INFERIOR), d('Superior B', SUPERIOR), d('Inferior B', INFERIOR)] }
  if (dias === 5) return { nome: 'Superior / inferior + empurrar / puxar / pernas', dias: [d('Superior', SUPERIOR), d('Inferior', INFERIOR), d('Empurrar', EMPURRAR), d('Puxar', PUXAR), d('Pernas', INFERIOR)] }
  return { nome: 'Empurrar / puxar / pernas, 2x cada', dias: [d('Empurrar A', EMPURRAR), d('Puxar A', PUXAR), d('Pernas A', INFERIOR), d('Empurrar B', EMPURRAR), d('Puxar B', PUXAR), d('Pernas B', INFERIOR)] }
}

// Séries por semana de cada grupo (faixa) pelo nível: iniciante 6–10, intermediário 10–14, avançado 12–20.
// Volume maior dá mais hipertrofia, com retorno decrescente (Schoenfeld 2017; Pelland 2026).
const FAIXA = { iniciante: [6, 10], intermediario: [10, 14], avancado: [12, 20] } as const
type Nivel = keyof typeof FAIXA
function nivel(r: Respostas): Nivel {
  if (r.experiencia === 'nunca' || r.experiencia === 'menos6m' || r.tempoParado === 'mais1a') return 'iniciante'
  return r.experiencia === 'mais2a' && r.tempoParado !== '3a12m' ? 'avancado' : 'intermediario'
}
const MIN_POR_TREINO: Record<string, number> = { ate30: 30, '30a45': 40, '45a60': 55, mais60: 75 }
const MIN_POR_SERIE = 3 // série + descanso + troca de aparelho, em média

const DOR_CUIDADO: Record<string, string> = {
  agachar: 'Agachar piora a dor: comece com amplitude que não doa (ex.: leg press parcial, agachamento no banco).',
  acimaCabeca: 'Braço acima da cabeça piora a dor: troque desenvolvimento por elevações até 90° no início.',
  empurrar: 'Empurrar piora a dor: prefira máquinas guiadas e pegada neutra.',
  puxar: 'Puxar piora a dor: prefira remadas com apoio e amplitude parcial.',
  curvarTronco: 'Curvar o tronco piora a dor: evite flexão de coluna com carga; ensine a dobradiça de quadril leve.',
  impacto: 'Impacto piora a dor: sem saltos nem corrida; aeróbico em bicicleta ou elíptico.',
  sentado: 'Ficar sentado piora a dor: prefira exercícios em pé ou deitado e pausas para caminhar.',
  escada: 'Subir escada piora a dor: step e afundo só depois, com altura baixa.',
}

export function esqueletoTreino(r: Respostas): Esqueleto | null {
  const diasQuer = typeof r.diasSemana === 'number' ? r.diasSemana : null
  if (!diasQuer) return null
  const regras: string[] = []
  const cuidados: string[] = []
  const nv = nivel(r)
  const dias = Math.min(diasQuer, 6)
  if (diasQuer === 7) regras.push('7 dias disponíveis: sugerido 6, com 1 de descanso.')
  const div = divisao(dias)
  regras.push(`Divisão pelos ${dias} dias por semana: cada grupo 2x ou mais por semana quando possível (Schoenfeld 2019).`)

  // Volume semanal: prioridades no topo da faixa, o resto no meio (iniciante sempre no piso).
  const [min, max] = FAIXA[nv]
  const prio = new Set(Array.isArray(r.prioridades) ? (r.prioridades as Grupo[]) : [])
  const base = nv === 'iniciante' ? min : Math.round((min + max) / 2)
  const seriesSemana = Object.fromEntries(GRUPOS.map((g) => [g, prio.has(g) ? max : base])) as Record<Grupo, number>
  regras.push(`Nível ${nv === 'iniciante' ? 'iniciante' : nv === 'avancado' ? 'avançado' : 'intermediário'}: ${min} a ${max} séries por grupo na semana${prio.size ? '; regiões priorizadas no topo' : ''}.`)

  // Séries de cada dia = semanais ÷ vezes que o grupo aparece. Depois, cabe no tempo do treino.
  const vezes = (g: Grupo) => div.dias.filter((d) => d.grupos.includes(g)).length
  let diasOut: Dia[] = div.dias.map((d) => ({ nome: d.nome, grupos: d.grupos.map((g) => ({ grupo: g, series: Math.max(1, Math.round(seriesSemana[g] / vezes(g))) })) }))
  const minutos = MIN_POR_TREINO[String(r.minutos)] ?? 55
  const teto = Math.floor(minutos / MIN_POR_SERIE)
  const maior = Math.max(...diasOut.map((d) => d.grupos.reduce((s, x) => s + x.series, 0)))
  if (maior > teto) {
    const f = teto / maior
    diasOut = diasOut.map((d) => ({ ...d, grupos: d.grupos.map((x) => ({ ...x, series: Math.max(1, Math.floor(x.series * f)) })) }))
    for (const g of GRUPOS) seriesSemana[g] = diasOut.reduce((s, d) => s + (d.grupos.find((x) => x.grupo === g)?.series ?? 0), 0)
    regras.push(`Volume reduzido para caber em cerca de ${minutos} min por treino (uns ${MIN_POR_SERIE} min por série).`)
  }

  // Repetições e distância da falha pelo objetivo; iniciante longe da falha (técnica e segurança).
  const obj = String(r.objetivo ?? 'hipertrofia')
  const reps = obj === 'forca' ? '3 a 6 nos multiarticulares; 8 a 12 nos acessórios' : obj === 'condicionamento' ? '12 a 20, em circuito' : obj === 'saude' ? '8 a 15' : '6 a 15'
  const rir = nv === 'iniciante' || obj === 'saude' ? '3 a 4 repetições antes da falha' : '1 a 3 repetições antes da falha'
  regras.push('Faixa de repetições pelo objetivo; perto da falha dá mais hipertrofia, com retorno decrescente (Robinson 2024).')
  const aerobico = obj === 'emagrecimento' || obj === 'saude' || obj === 'condicionamento' ? '150 min por semana de aeróbico moderado (ou 75 min vigoroso), somando os dias.' : null

  // Cuidados (não é diagnóstico; o coach decide).
  const dores = Array.isArray(r.dores) ? (r.dores as string[]) : []
  if (dores.length) {
    for (const k of Array.isArray(r.dorPiora) ? (r.dorPiora as string[]) : []) if (DOR_CUIDADO[k]) cuidados.push(DOR_CUIDADO[k])
    if (typeof r.dorIntensidade === 'number' && r.dorIntensidade >= 6) cuidados.push('Dor forte (6 ou mais): começar leve e combinar avaliação com fisioterapeuta ou médico.')
    if (dores.includes('lombar') && r.dorTempo === 'mais3m') cuidados.push('Dor lombar crônica: exercício ajuda a reduzir a dor (Cochrane, certeza moderada); progrida pela dor do dia.')
    cuidados.push('Use o monitoramento da dor: até 5 de 10 durante o exercício e de volta ao normal no dia seguinte (Silbernagel 2007).')
  }
  const sintomas = Array.isArray(r.sintomasEsforco) && r.sintomasEsforco.length > 0
  const doenca = Array.isArray(r.condicoes) && (r.condicoes as string[]).some((c) => ['cardiaca', 'renal', 'diabetes'].includes(c))
  if (sintomas) cuidados.unshift('Sinais ao esforço: pedir liberação médica antes de subir a intensidade (ACSM).')
  else if (doenca && r.ativo3m !== true) cuidados.unshift('Doença do coração, dos rins ou diabetes sem treino recente: liberação médica antes de começar (ACSM).')
  else if (doenca) cuidados.push('Doença do coração, dos rins ou diabetes: pode seguir em intensidade moderada; liberação médica para vigorosa (ACSM).')
  if (r.gestante === 'sim') cuidados.unshift('Gestante ou pós-parto recente: liberação do obstetra e ajuste do treino.')
  if (typeof r.evitar === 'string' && r.evitar.trim()) cuidados.push(`O aluno pediu para evitar: ${r.evitar.trim()}`)
  if (Array.isArray(r.preferencias) && r.preferencias.includes('maquinas') && nv === 'iniciante') regras.push('Prefere máquinas e é iniciante: boas para aprender o movimento.')

  return { divisao: div.nome, dias: diasOut, seriesSemana, reps, rir, aerobico, cuidados, regras }
}
