// #261: cada treino grava a máquina usada (cópia da escala na prescricaoRegistrada do registro).
import { describe, expect, it } from 'vitest'
import { mesoPadrao } from '../features/coach/meso/mesoPadrao'
import type { MaquinaTreino } from '../engine/aparelho'
import { iniciarEdicao, trocarExercicio, trocarMaquina } from '../engine/editarSessao'
import { metodosDaSessao, prescreverSessao } from '../engine/sessao'
import type { Meso } from '../engine/tipos'
import { deDoc, maquinaDesconhecida, maquinaUsada, mesmaEscala, paraSlot, textoMaquina, validarMaquina, type EntradaMaquina, type Maquina } from './maquinas'
import { comPrescricoesRegistradas, lerPrescricaoRegistrada } from './prescricaoRegistrada'
import { mesoSchema } from './prescricaoSchema'

// Dados sintéticos. Os campos privados (local, obs, marca, modelo, id do catálogo) têm textos marcados para a busca.
const PRIVADO = ['LOCAL-SECRETO', 'OBS-SECRETA', 'MARCA-SECRETA', 'MODELO-SECRETO', 'm-id-do-catalogo']
const CA: Maquina = {
  id: 'm-id-do-catalogo-a', ref: 'mq-aaaaaaaaaaaaaaaaaaa1', nome: 'Extensora', local: 'LOCAL-SECRETO', obs: 'OBS-SECRETA', fabricante: 'MARCA-SECRETA',
  modelo: 'MODELO-SECRETO', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgNivel: [5, 10, 15], porLado: false, exercicios: ['cadeira-extensora-tradicional'],
}
const CB: Maquina = {
  id: 'm-id-do-catalogo-b', ref: 'mq-bbbbbbbbbbbbbbbbbbb2', nome: 'Extensora', rotuloAluno: 'Extensora 2', local: 'Condomínio', tipo: 'maquina',
  unidade: 'kg', incremento: 5, maximo: 80, porLado: false, exercicios: [],
}
const A = paraSlot(CA)!
const B = paraSlot(CB)!
const semPrivado = (texto: string) => PRIVADO.filter((p) => texto.includes(p))
const NOME = 'Cadeira Extensora Tradicional'

const comMaquina = (m: Meso, maquina: MaquinaTreino | null): Meso => ({
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
    const A2 = paraSlot({ ...CA, niveis: 15, kgNivel: [6, 12] })!
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

  it('mesmaEscala percebe mudança de escala ou de rótulo; cadastro sem ref não vai para o treino', () => {
    expect(mesmaEscala(A, CA)).toBe(true)
    expect(mesmaEscala(A, { ...CA, local: 'Outro', obs: 'outra' })).toBe(true) // privado não conta
    expect(mesmaEscala(A, { ...CA, niveis: 14 })).toBe(false)
    expect(mesmaEscala(A, { ...CA, rotuloAluno: 'Extensora 1' })).toBe(false)
    expect(paraSlot({ ...CA, ref: undefined })).toBeNull()
  })

  it('textoMaquina: só o rótulo do aluno (anotar em nível só com a carga por máquina, #262)', () => {
    expect(textoMaquina(A)).toBe('Extensora')
    expect(textoMaquina(B)).toBe('Extensora 2')
  })
})

describe('privacidade: local e observação ficam no catálogo', () => {
  it('projeção explícita: só ref, rótulo e escala', () => {
    expect(A).toEqual({ ref: CA.ref, nome: 'Extensora', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgNivel: [5, 10, 15], porLado: false })
    expect(B).toEqual({ ref: CB.ref, nome: 'Extensora 2', tipo: 'maquina', unidade: 'kg', incremento: 5, maximo: 80, porLado: false })
    // Campo novo no catálogo não vaza: a lista é de permissão, não de exclusão.
    expect(paraSlot({ ...CA, segredoFuturo: 'x' } as Maquina)).toEqual(A)
  })

  it('nada privado no plano, na tela (prescrição), na cópia do registro nem no conector', () => {
    const m = comMaquina(mesoPadrao(), A)
    const { sessoes: _s, prescricoesRegistradas: _p, prescricoesAnteriores: _a, historicoIncerto: _h, ...plano } = m
    const lido = mesoSchema.safeParse(plano)
    expect(lido.success).toBe(true)
    expect(semPrivado(JSON.stringify(lido.data))).toEqual([])
    const reg = iniciar(m, 1)
    expect(semPrivado(reg.prescricaoRegistrada)).toEqual([])
    const tela = prescreverSessao(comPrescricoesRegistradas(m, [reg]), 1, 1)
    expect(semPrivado(JSON.stringify(tela))).toEqual([])
    expect(textoMaquina(tela!.exercicios[0].slot.maquina!)).toBe('Extensora')
  })

  it('o contrato recusa local, obs, marca, modelo ou id do catálogo na máquina do exercício', () => {
    const { sessoes: _s, prescricoesRegistradas: _p, prescricoesAnteriores: _a, historicoIncerto: _h, ...plano } = comMaquina(mesoPadrao(), A)
    for (const extra of [{ local: 'X' }, { obs: 'X' }, { fabricante: 'X' }, { modelo: 'X' }, { id: 'm-academia-extensora' }]) {
      expect(mesoSchema.safeParse({ ...plano, divisao: [[{ slotId: 'ext', nome: NOME, maquina: { ...A, ...extra } }], [], []] }).success).toBe(false)
    }
    // Cópia de registro com campo privado (ex.: cliente antigo desta PR) não vale: o plano é usado no lugar.
    const texto = iniciar(comMaquina(mesoPadrao(), A), 1).prescricaoRegistrada.replace('"ref":', '"local":"X","ref":')
    expect(lerPrescricaoRegistrada(texto)).toBeNull()
  })
})

describe('identidade opaca', () => {
  const entrada: EntradaMaquina = { nome: 'Extensora', local: 'LOCAL-SECRETO', tipo: 'maquina', unidade: 'nivel', niveis: 12, kgTopo: 5, kgPlaca: 5, porLado: false, exercicios: [] }
  const cadastrar = (lista: Maquina[]) => {
    const r = validarMaquina(entrada, lista, 'Coach')
    if ('erro' in r) throw new Error(r.erro)
    return deDoc({ ...r.dados, id: r.id })
  }

  it('id e ref sorteados: sem nome nem local', () => {
    const a = cadastrar([])
    expect(a.id).toMatch(/^m-[a-z0-9]{20}$/)
    expect(a.ref).toMatch(/^mq-[a-z0-9]{20}$/)
    expect(semPrivado(a.id + a.ref)).toEqual([])
    expect(`${a.id}${a.ref}`.includes('extensora')).toBe(false)
  })

  it('A aposentada → B com mesmo nome, local e escala recebe outra identidade; o histórico de A fica com A', () => {
    const a = cadastrar([])
    const base = mesoPadrao()
    const regA = iniciar(comMaquina(base, paraSlot(a)), 1) // série em A (gravada offline ao iniciar)
    const b = cadastrar([]) // A apagada do catálogo: a lista não tem mais A
    expect(b.id).not.toBe(a.id)
    expect(b.ref).not.toBe(a.ref)
    expect(paraSlot(b)).toEqual({ ...paraSlot(a), ref: b.ref })
    // Plano agora com B; o registro sincronizado depois continua em A.
    const meso = comPrescricoesRegistradas(comMaquina(base, paraSlot(b)), [regA])
    expect(maquinaUsada(meso, 1, 1, 'ext')).toEqual({ maquina: paraSlot(a) })
    expect(prescreverSessao(meso, 2, 1)?.exercicios[0].slot.maquina?.ref).toBe(b.ref)
  })

  it('editar mantém id e ref; cadastro antigo sem ref ganha uma, sem trocar o id', () => {
    const a = cadastrar([])
    const r = validarMaquina({ ...entrada, niveis: 10 }, [a], 'Coach', a.id)
    expect('erro' in r ? r : { id: r.id, ref: r.dados.ref }).toEqual({ id: a.id, ref: a.ref })
    const antiga = { ...a, id: 'm-academia-extensora', ref: undefined }
    const r2 = validarMaquina(entrada, [antiga], 'Coach', antiga.id)
    if ('erro' in r2) throw new Error(r2.erro)
    expect(r2.id).toBe('m-academia-extensora')
    expect(r2.dados.ref).toMatch(/^mq-[a-z0-9]{20}$/)
  })
})
