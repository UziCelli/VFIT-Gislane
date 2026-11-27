// #261: cada treino grava a máquina usada (cópia da escala na prescricaoRegistrada do registro).
import { describe, expect, it } from 'vitest'
import { mesoPadrao } from '../features/coach/meso/mesoPadrao'
import type { Aparelho, AparelhoKg, AparelhoNivel } from '../engine/aparelho'
import { iniciarEdicao, trocarExercicio, trocarMaquina } from '../engine/editarSessao'
import { metodosDaSessao, prescreverSessao } from '../engine/sessao'
import type { Meso } from '../engine/tipos'
import { maquinaDesconhecida, maquinaUsada, mesmaEscala, paraSlot, textoMaquina, type Maquina } from './maquinas'
import { comPrescricoesRegistradas, lerPrescricaoRegistrada } from './prescricaoRegistrada'
import { mesoSchema } from './prescricaoSchema'

const A: AparelhoNivel = { id: 'm-academia-extensora', nome: 'Extensora', local: 'Academia', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgNivel: [5, 10, 15], porLado: false }
const B: AparelhoKg = { id: 'm-condominio-extensora', nome: 'Extensora', local: 'Condomínio', tipo: 'maquina', unidade: 'kg', incremento: 5, maximo: 80, porLado: false }
const NOME = 'Cadeira Extensora Tradicional'

const comMaquina = (m: Meso, maquina: Aparelho | null): Meso => ({
  ...m, divisao: [[maquina ? { slotId: 'ext', nome: NOME, maquina } : { slotId: 'ext', nome: NOME }], [], []],
})
// O que o Treino.tsx grava ao tocar em "Iniciar treino" (marcarInicio).
const iniciar = (m: Meso, semana: number) => ({
  semana, treino: 1, prescricaoRegistrada: JSON.stringify({ versao: 1, sessao: prescreverSessao(m, semana, 1), metodos: metodosDaSessao(m, semana, 1) }),
})

describe('troca A → B → A', () => {
  it('cada treino fica com a máquina do dia; o plano atual não reescreve o passado', () => {
    const base = mesoPadrao()
    const registros = [iniciar(comMaquina(base, A), 1), iniciar(comMaquina(base, B), 2), iniciar(comMaquina(base, A), 3)]
    const meso = comPrescricoesRegistradas(comMaquina(base, A), registros)
    expect(maquinaUsada(meso, 1, 1, 'ext')).toEqual({ maquina: A })
    expect(maquinaUsada(meso, 2, 1, 'ext')).toEqual({ maquina: B })
    expect(maquinaUsada(meso, 3, 1, 'ext')).toEqual({ maquina: A })
    // A tela do treino (semana 2) mostra B, mesmo com A no plano agora.
    expect(prescreverSessao(meso, 2, 1)?.exercicios[0].slot.maquina).toEqual(B)
    expect(prescreverSessao(meso, 4, 1)?.exercicios[0].slot.maquina).toEqual(A)
  })

  it('editar a escala de A depois não muda o treino já feito com A', () => {
    const base = mesoPadrao()
    const registros = [iniciar(comMaquina(base, A), 1)]
    const A2: AparelhoNivel = { ...A, niveis: 15, kgNivel: [6, 12] }
    const meso = comPrescricoesRegistradas(comMaquina(base, A2), registros)
    expect(maquinaUsada(meso, 1, 1, 'ext')).toEqual({ maquina: A })
    expect(prescreverSessao(meso, 2, 1)?.exercicios[0].slot.maquina).toEqual(A2)
  })
})

describe('legado', () => {
  it('registro sem cópia (antigo) é "legado", mesmo com máquina no plano: nada de inferir', () => {
    const meso = comPrescricoesRegistradas(comMaquina(mesoPadrao(), A), [{ semana: 1, treino: 1, cargas: { ext: { s1: 3 } } }])
    expect(maquinaUsada(meso, 1, 1, 'ext')).toBe('legado')
    expect(maquinaUsada(meso, 2, 1, 'ext')).toBe('legado') // ainda não treinou
  })

  it('cópia reconstruída de cliente antigo (referência histórica) também é "legado"', () => {
    const m = comMaquina(mesoPadrao(), A)
    expect(maquinaUsada({ prescricoesRegistradas: { '1-1': { ...JSON.parse(iniciar(m, 1).prescricaoRegistrada), referenciaHistorica: true } } }, 1, 1, 'ext')).toBe('legado')
  })

  it('tela: treino registrado sem cópia esconde a máquina do plano; sem registro, mostra o plano', () => {
    const m = comMaquina(mesoPadrao(), A)
    const antigo = comPrescricoesRegistradas(m, [{ semana: 1, treino: 1, cargas: { ext: { s1: 3 } } }])
    expect(maquinaDesconhecida(antigo, 1, 1, { cargas: { ext: { s1: 3 } } })).toBe(true)
    expect(maquinaDesconhecida(antigo, 1, 1, { realizado: true })).toBe(true)
    expect(maquinaDesconhecida(antigo, 2, 1, undefined)).toBe(false) // ainda não treinou: vale o plano
    expect(maquinaDesconhecida(antigo, 2, 1, { cargas: {}, realizado: false })).toBe(false)
    const novo = comPrescricoesRegistradas(m, [iniciar(m, 1)])
    expect(maquinaDesconhecida(novo, 1, 1, { inicioEm: null })).toBe(false) // cópia confiável (início pendente offline)
  })

  it('treino registrado sem máquina no exercício: null (sabido), não legado', () => {
    const meso = comPrescricoesRegistradas(comMaquina(mesoPadrao(), A), [iniciar(comMaquina(mesoPadrao(), null), 1)])
    expect(maquinaUsada(meso, 1, 1, 'ext')).toEqual({ maquina: null })
  })
})

describe('cópia gravada', () => {
  it('a máquina sobrevive à leitura da cópia; máquina inválida invalida a cópia (o plano vale)', () => {
    const texto = iniciar(comMaquina(mesoPadrao(), A), 1).prescricaoRegistrada
    expect(lerPrescricaoRegistrada(texto)?.sessao.exercicios[0].slot.maquina).toEqual(A)
    const ruim = texto.replace('"niveis":12', '"niveis":0')
    expect(lerPrescricaoRegistrada(ruim)).toBeNull()
  })

  it('o conector aceita meso com máquina no exercício (e recusa campo estranho nela)', () => {
    const m = comMaquina(mesoPadrao(), A)
    const { sessoes: _s, prescricoesRegistradas: _p, prescricoesAnteriores: _a, historicoIncerto: _h, ...resto } = m
    expect(mesoSchema.safeParse(resto).success).toBe(true)
    expect(mesoSchema.safeParse({ ...resto, divisao: [[{ slotId: 'ext', nome: NOME, maquina: { ...A, exercicios: [] } }], [], []] }).success).toBe(false)
  })
})

describe('presencial e montagem', () => {
  it('máquina escolhida no presencial vale para o dia, mesmo trocada depois do início', () => {
    const m = comMaquina(mesoPadrao(), A)
    const iniciado = comPrescricoesRegistradas(m, [iniciar(m, 1)])
    // salvarSessaoEditada grava a sessão e anula a cópia do dia (prescricoesRegistradas[chave] = null).
    const ajustado = { ...iniciado, sessoes: { '1-1': trocarMaquina(iniciarEdicao(iniciado, 1, 1), 1, B) }, prescricoesRegistradas: { ...iniciado.prescricoesRegistradas, '1-1': null } }
    const comRegistros = comPrescricoesRegistradas(ajustado, [iniciar(m, 1)])
    expect(maquinaUsada(comRegistros, 1, 1, 'ext')).toEqual({ maquina: B })
    expect(maquinaDesconhecida(comRegistros, 1, 1, { inicioEm: 1, cargas: { ext: { s1: 4 } } })).toBe(false)
    expect(prescreverSessao(comRegistros, 1, 1)?.exercicios[0].slot.maquina).toEqual(B)
    // "Voltar ao planejado" (sem sessão, cópia anulada): o dia segue o plano, que pode mudar; fica desconhecido.
    const voltou = { ...comRegistros, sessoes: {} }
    expect(maquinaUsada(voltou, 1, 1, 'ext')).toBe('legado')
  })

  it('máquina só de hoje; trocar o exercício tira a máquina', () => {
    const m = comMaquina(mesoPadrao(), A)
    const s = trocarMaquina(iniciarEdicao(m, 1, 1), 1, B)
    expect(s.exercicios[0].maquina).toEqual(B)
    expect(trocarMaquina(s, 1, null).exercicios[0]).not.toHaveProperty('maquina')
    expect(trocarExercicio(s, 1, 'Leg Press 45', 'novo').exercicios[0]).not.toHaveProperty('maquina')
    expect(m.divisao[0][0].maquina).toEqual(A) // o plano não muda
  })

  it('paraSlot tira observação e exercícios; mesmaEscala percebe mudança de escala', () => {
    const cat: Maquina = { ...A, obs: 'pino à direita', exercicios: ['cadeira-extensora-tradicional'] }
    expect(paraSlot(cat)).toEqual(A)
    expect(mesmaEscala(A, cat)).toBe(true)
    expect(mesmaEscala(A, { ...cat, niveis: 14 })).toBe(false)
  })

  it('textoMaquina: só nome e local (anotar em nível só com a carga por máquina, #262)', () => {
    expect(textoMaquina(A)).toBe('Extensora · Academia')
    expect(textoMaquina(B)).toBe('Extensora · Condomínio')
  })
})
