import { metodosDaSessao, type ExercicioPrescrito, type Meso, type Sessao } from '../engine'

const METODOS_SEQUENCIA = /Biset|Triset|Superset|Circuito/

export type ItemExibicao = {
  e: ExercicioPrescrito
  /** `Método|grupo` quando o exercício faz parte de um grupo de 2+ exercícios; senão null. */
  grupo: string | null
  /** Posição dentro do grupo (0, 1, …). */
  ordem: number
  /** Total de exercícios do grupo (1 sem grupo). */
  tamanho: number
  /** Letra do grupo (A, B, …), na ordem em que os grupos aparecem. */
  letra: string
}

// Ordem em que o aluno vê os exercícios: os do mesmo grupo de método (Biset, Triset…) ficam juntos.
// Mesma regra da tela do treino (`aluno/Treino.tsx`); usada pela prévia do editor.
export function ordemExibicao(meso: Meso, semana: number, treino: number, sessao: Sessao): ItemExibicao[] {
  const metodos = metodosDaSessao(meso, semana, treino)
  const grupoDe = (pos: number) => {
    const l = metodos.find((x) => x.ativo && x.exercicio === pos && x.grupo != null && METODOS_SEQUENCIA.test(x.metodo))
    return l ? `${l.metodo}|${l.grupo}` : null
  }
  const brutas = sessao.exercicios.map((e) => grupoDe(e.pos))
  const chaves = brutas.map((c) => (brutas.filter((x) => x === c).length >= 2 ? c : null)) // grupo de 1 só exercício não é grupo
  const ordemGrupos = [...new Set(chaves.filter(Boolean))]
  const visitado = new Set<number>()
  return sessao.exercicios.flatMap((e, i) => {
    if (visitado.has(i)) return []
    const membros = chaves[i] ? sessao.exercicios.flatMap((x, j) => (chaves[j] === chaves[i] ? [j] : [])) : [i]
    membros.forEach((j) => visitado.add(j))
    return membros.map((j, ordem) => ({
      e: sessao.exercicios[j],
      grupo: chaves[j],
      ordem,
      tamanho: membros.length,
      letra: chaves[j] ? String.fromCharCode(65 + ordemGrupos.indexOf(chaves[j])) : '',
    }))
  })
}
