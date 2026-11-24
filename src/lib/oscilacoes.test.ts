import { describe, expect, it } from 'vitest'
import { diaSP } from './acesso'
import type { Avaliacao } from './avaliacao'
import type { RelatoDor } from './dor'
import type { Ocorrencia } from './evolucao'
import { oscilacoes } from './oscilacoes'

const av = (id: string, data: string, perimetros: Avaliacao['perimetros']): Avaliacao => ({ id, alunoId: 'u', data, pesoKg: 80, perimetros, dobras: {}, bio: {}, comentario: '', liberado: true })
const dia = (iso: string) => diaSP(Date.parse(`${iso}T12:00Z`))
const oc = (iso: string, carga: number): Ocorrencia => ({ mesoId: 'm', semana: 1, treino: 1, dia: dia(iso), conta: true, cargaMax: carga, volume: null, movimentos: 1 })

describe('oscilacoes', () => {
  const ant = av('a1', '2026-01-01', { coxaD: 60, abdomen: 90 })
  const atual = av('a2', '2026-03-01', { coxaD: 58, abdomen: 90.6 })
  const hist = { 'Leg Press 45': [oc('2026-01-05', 200), oc('2026-01-10', 200), oc('2026-01-15', 190), oc('2026-02-20', 170)] }
  const dor = { id: 'd', alunoId: 'u', exercicio: 'Leg Press 45', articulacao: 'joelho', tipo: 'dor', intensidade: 5, momento: 'durante', texto: '', em: { toMillis: () => Date.parse('2026-01-20T12:00Z') }, resposta: null, respondidoEm: null, vistoEm: null, sessao: null } as unknown as RelatoDor
  it('dor + carga caiu + medida menor: inferência, sem causa', () => {
    const coxas = oscilacoes(atual, ant, hist, [dor]).find((o) => o.id === 'coxas')!
    expect(coxas.fatos.join(' ')).toMatch(/relato de dor/)
    expect(coxas.inferencia).toMatch(/pode ter levado/)
  })
  it('abdômen: 0,6 cm fica dentro do erro e pede cautela', () => {
    const abd = oscilacoes(atual, ant, hist, []).find((o) => o.id === 'abdomen')!
    expect(abd.fatos[0]).toMatch(/dentro do erro/)
    expect(abd.inferencia).toMatch(/cautela/)
  })
})
