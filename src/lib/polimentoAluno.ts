// Polimento visto pelo aluno: o que muda no exercício, no dia e na semana, em poucas palavras. Funções puras.
import { prescreverSessao, type ExercicioPrescrito, type Meso, type Sessao } from '../engine'

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const series = (n: number) => `${n} ${n === 1 ? 'série' : 'séries'}`

// Compara com a prescrição normal do mesmo slot (sem polimento). Sem ela, diz só o que o polimento guarda (carga e folga).
export function mudancasPolimento(e: ExercicioPrescrito, normal?: ExercicioPrescrito): string[] | null {
  if (e.polimento == null) return null
  const ref = normal?.slot.slotId === e.slot.slotId ? normal : undefined
  const partes: string[] = []
  if (ref && e.n < ref.n) partes.push(`${series(e.n)} (eram ${ref.n})`)
  else if (ref && soma(e.repsBase ?? e.reps) < soma(ref.repsBase ?? ref.reps)) partes.push('menos repetições')
  if (ref?.rotulo && !e.rotulo) partes.push(`sem ${[...new Set(ref.rotulo.split('; ').map((p) => p.split(' [')[0].trim()))].join(' e ')}`)
  if (e.polimento > 0) partes.push('carga mais leve')
  if (e.folgaPolimento != null) partes.push(`pare com ${e.folgaPolimento} ${e.folgaPolimento === 1 ? 'repetição' : 'repetições'} de sobra`)
  return partes.length ? partes : ['volume menor']
}

// 'dia': metade ou mais dos exercícios em polimento (o aviso vai para o topo do treino).
// 'exercicio': só alguns; o destaque fica no card de cada um.
export function escopoPolimento(s: Sessao | null | undefined): 'dia' | 'exercicio' | null {
  const k = s?.exercicios.filter((e) => e.polimento != null).length ?? 0
  if (!s || !k) return null
  return k * 2 >= s.exercicios.length ? 'dia' : 'exercicio'
}

// Semana de polimento: todos os treinos da semana são dias de polimento.
export function semanaDePolimento(meso: Meso, semana: number): boolean {
  if (!meso.polimentos || !(meso.frequencia > 0)) return false
  return Array.from({ length: meso.frequencia }, (_, i) => i + 1).every((t) => escopoPolimento(prescreverSessao(meso, semana, t)) === 'dia')
}

// Resumo do dia em até três itens.
export function resumoPolimento(s: Sessao): string {
  const ex = s.exercicios.filter((e) => e.polimento != null)
  return [
    'menos volume',
    ex.some((e) => (e.polimento ?? 0) > 0) && 'carga mais leve',
    ex.some((e) => e.folgaPolimento != null) && 'sem ir ao limite',
  ].filter(Boolean).join(' · ')
}
