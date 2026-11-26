import { describe, expect, it } from 'vitest'
import { dataDaNota, msDaNota, notaDoExercicio } from './notas'

const DIA = 86_400_000
// 12/11/2026 15:00 em São Paulo
const AGORA = Date.UTC(2026, 10, 12, 18, 0)

describe('dataDaNota', () => {
  it('sem data (anotação antiga)', () => {
    expect(dataDaNota(undefined, AGORA)).toBe('sem data')
  })

  it('hoje, ontem e dias', () => {
    expect(dataDaNota(AGORA - 3_600_000, AGORA)).toBe('12/11 · hoje')
    expect(dataDaNota(AGORA - DIA, AGORA)).toBe('11/11 · ontem')
    expect(dataDaNota(AGORA - 5 * DIA, AGORA)).toBe('07/11 · há 5 dias')
  })

  it('semanas e meses', () => {
    expect(dataDaNota(AGORA - 14 * DIA, AGORA)).toBe('29/10 · há 2 semanas')
    expect(dataDaNota(AGORA - 7 * DIA, AGORA)).toBe('05/11 · há 1 semana')
    expect(dataDaNota(AGORA - 40 * DIA, AGORA)).toBe('03/10 · há 1 mês')
    expect(dataDaNota(AGORA - 100 * DIA, AGORA)).toBe('04/08 · há 3 meses')
  })

  it('mais de um ano mostra o ano', () => {
    expect(dataDaNota(AGORA - 400 * DIA, AGORA)).toBe('08/10/2025 · há 13 meses')
  })

  it('vira o dia pelo horário de São Paulo (23h de ontem é ontem)', () => {
    const ontem23h = Date.UTC(2026, 10, 12, 2, 0) // 11/11 23:00 em SP
    expect(dataDaNota(ontem23h, AGORA)).toBe('11/11 · ontem')
  })
})

describe('msDaNota', () => {
  it('antiga, pendente (offline) e gravada', () => {
    expect(msDaNota(undefined, AGORA)).toBeUndefined()
    expect(msDaNota(null, AGORA)).toBe(AGORA)
    expect(msDaNota({ toMillis: () => 5 }, AGORA)).toBe(5)
  })
})

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { textoNota } from './notas'

describe('anotações recebidas do banco', () => {
  it('ignora objetos e outros valores que quebrariam a tela do coach', () => {
    for (const valor of [{ inesperado: true }, ['texto'], null, undefined, 1, true]) {
      expect(textoNota(valor)).toBe('')
      expect(() => renderToString(createElement('p', null, textoNota(valor)))).not.toThrow()
    }
  })
  it('mantém texto válido e limita ao tamanho do editor', () => {
    expect(textoNota('Banco 3')).toBe('Banco 3')
    expect(textoNota('x'.repeat(10000))).toHaveLength(300)
  })
})

describe('notaDoExercicio (nome antigo e novo do catálogo)', () => {
  const ts = (ms: number) => ({ toMillis: () => ms })
  it('acha a anotação gravada sob o nome antigo quando o slot usa o nome novo', () => {
    const n = { exercicios: { 'Rosca Direta Cabo': 'banco 3' }, datas: { 'Rosca Direta Cabo': ts(1000) } }
    expect(notaDoExercicio(n, 'Rosca Direta Polia')).toEqual({ texto: 'banco 3', em: 1000, outras: ['Rosca Direta Cabo'] })
  })
  it('com nota nos dois nomes, vale a mais recente; a do nome do slot não entra em outras', () => {
    const n = { exercicios: { 'Rosca Direta Cabo': 'velha', 'Rosca Direta Polia': 'nova' }, datas: { 'Rosca Direta Cabo': ts(1000), 'Rosca Direta Polia': ts(2000) } }
    expect(notaDoExercicio(n, 'Rosca Direta Polia')).toEqual({ texto: 'nova', em: 2000, outras: ['Rosca Direta Cabo'] })
    expect(notaDoExercicio(n, 'Rosca Direta Cabo').texto).toBe('nova')
  })
  it('outro exercício e nota vazia não entram; sem nota: vazio', () => {
    const n = { exercicios: { 'Rosca Direta Barra': 'x', 'Rosca Direta Polia': '' } }
    expect(notaDoExercicio(n, 'Rosca Direta Cabo')).toEqual({ texto: '', em: undefined, outras: [] })
    expect(notaDoExercicio(null, 'Supino')).toEqual({ texto: '', em: undefined, outras: [] })
  })
})
