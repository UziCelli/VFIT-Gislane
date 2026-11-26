// Pílulas do exercício (épico #255, etapa 3 #258): o que o nome não deixa claro de relance. Função pura.
// Ordem fixa: equipamento → lados → modo. O padrão (bilateral, dinâmico) não vira pílula, para não poluir.
// Nome fora do catálogo (texto livre): nenhuma pílula. Nunca adivinha.
import { EQUIPAMENTOS, resolverExercicio, type Equipamento } from '../data/catalogo'

export type IdPilula = Equipamento | 'unilateral' | 'alternado' | 'isometrico' | 'excentrico'
export interface Pilula {
  id: IdPilula
  rotulo: string
}

// Rótulos curtos para caber no celular; o nome completo já diz o resto.
const CURTO: Partial<Record<Equipamento, string>> = { maquina_seletora: 'Seletora', peso_do_corpo: 'Corpo' }

export function pilulasDo(nome: string): Pilula[] {
  const e = resolverExercicio(nome)
  if (!e) return []
  const out: Pilula[] = []
  if (e.equipamento && e.equipamento !== 'outro') out.push({ id: e.equipamento, rotulo: CURTO[e.equipamento] ?? EQUIPAMENTOS[e.equipamento] })
  if (e.lateralidade === 'unilateral') out.push({ id: 'unilateral', rotulo: 'Unilateral' })
  if (e.lateralidade === 'alternado') out.push({ id: 'alternado', rotulo: 'Alternado' })
  if (e.modo.includes('isometrico')) out.push({ id: 'isometrico', rotulo: 'Isométrico' })
  if (e.modo.includes('excentrico')) out.push({ id: 'excentrico', rotulo: 'Excêntrico' })
  return out
}
