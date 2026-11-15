import { describe, expect, it } from 'vitest'
import type { Usuario } from '../../../lib/acesso'
import { mesoPadrao } from '../meso/mesoPadrao'
import { prioridadesTreino } from './prioridades'

const aluno = (id: string, status: Usuario['status'] = 'ativo') => ({ id, nome: id, papel: 'aluno' as const, email: '', status })
const ciclo = (inicio: string, id = 'c1') => ({ id, alunoId: 'Ana', meso: { ...mesoPadrao(), inicio, semanas: 2 } })
const agora = new Date('2026-11-14T15:00:00Z')
const calcular = (ciclos: ReturnType<typeof ciclo>[], avaliacoes: { alunoId: string; data: string }[] = [], sinais: { alunoId: string; motivo: string }[] = []) => prioridadesTreino([aluno('Ana')], ciclos, avaliacoes, sinais, agora)

describe('prioridades de treino', () => {
  it('destaca ausência de ciclo, ciclo encerrado e ciclo terminando em sete dias', () => {
    expect(calcular([])[0].motivos).toContain('Sem mesociclo cadastrado')
    expect(calcular([ciclo('2026-10-31')])[0].motivos[0]).toContain('encerrado')
    expect(calcular([ciclo('2026-11-08')])[0].motivos[0]).toContain('termina em breve')
    expect(calcular([ciclo('2026-11-09')])).toEqual([])
  })
  it('não pede próximo ciclo quando já há um futuro e não pede ciclo para aluno só com futuro', () => {
    expect(calcular([ciclo('2026-11-01'), ciclo('2026-11-20', 'c2')])).toEqual([])
    expect(calcular([ciclo('2026-11-20')])).toEqual([])
  })
  it('prefere ciclo em andamento quando há ciclos sobrepostos', () => {
    const longo = ciclo('2026-10-25', 'longo')
    longo.meso.semanas = 12
    const curto = ciclo('2026-11-01', 'curto')
    curto.meso.semanas = 1
    expect(calcular([longo, curto])).toEqual([])
  })
  it('agrupa avaliação e alertas sem repetir motivos e ignora avaliação futura', () => {
    const avs = [{ alunoId: 'Ana', data: '2026-11-12' }, { alunoId: 'Ana', data: '2026-11-15' }]
    const sinais = [{ alunoId: 'Ana', motivo: 'Revisar' }, { alunoId: 'Ana', motivo: 'Revisar' }]
    expect(calcular([ciclo('2026-11-09')], avs, sinais)[0].motivos).toEqual(['Avaliação recente em 12/11 · conferir o treino', 'Revisar'])
  })
  it('mantém avaliação recente anterior ao início do ciclo', () => {
    expect(calcular([ciclo('2026-11-09')], [{ alunoId: 'Ana', data: '2026-11-08' }])[0].motivos).toContain('Avaliação recente em 08/11 · conferir o treino')
  })
  it('exclui alunos aguardando e arquivados', () => {
    expect(prioridadesTreino([aluno('Ana', 'arquivado'), aluno('Bia', 'aguardando')], [], [], [], agora)).toEqual([])
  })
})
