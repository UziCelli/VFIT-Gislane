import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apagarPerto, chaveExercicio, conferirArquivo, filaDoCoach, limparMarcas, marcasNoTempo, mimeOk, momentosMarcados, resumoPorExercicio, simplificar, situacaoExecucao, type DocMidia, type Marca } from './midias'

const ts = (ms: number) => ({ toMillis: () => ms })
const d = (x: Partial<DocMidia>): DocMidia => ({
  id: 'a', alunoId: 'ana', autor: 'ana', tipo: 'execucao', exercicioId: 'supino-reto-barra', exercicio: 'Supino Reto Barra',
  sessao: { mesoId: 'm', semana: 1, treino: 1 }, status: 'pronto', bytes: 10, mime: 'video/mp4', duracaoS: 10, ...x,
})

describe('chaveExercicio', () => {
  it('catálogo pelo nome; fora dele, nome normalizado com prefixo', () => {
    expect(chaveExercicio(' supino reto BARRA ')).toBe('supino-reto-barra')
    expect(chaveExercicio('Meu Exercício Ñovo!')).toBe('x-meu-exercicio-novo')
    expect(chaveExercicio('***')).toBe('x-exercicio')
    expect(chaveExercicio('a'.repeat(200))).toMatch(/^x-a{88}$/)
  })
})

describe('arquivo', () => {
  it('mimeOk tira codecs e aceita só vídeo conhecido', () => {
    expect(mimeOk('video/mp4;codecs=avc1')).toBe('video/mp4')
    expect(mimeOk('VIDEO/WEBM')).toBe('video/webm')
    expect(mimeOk('video/x-matroska')).toBeNull()
  })
  it('conferirArquivo: formato, duração e tamanho', () => {
    expect(conferirArquivo({ bytes: 1e6, tipo: 'video/mp4', duracaoS: 30 }, 60)).toBeNull()
    expect(conferirArquivo({ bytes: 1e6, tipo: 'video/mp4', duracaoS: 60.4 }, 60)).toBeNull()
    expect(conferirArquivo({ bytes: 1e6, tipo: 'video/mp4', duracaoS: 61 }, 60)).toMatch(/longo/)
    expect(conferirArquivo({ bytes: 1e6, tipo: 'video/mp4', duracaoS: 0 }, 60)).toMatch(/ler/)
    expect(conferirArquivo({ bytes: 51 * 1048576, tipo: 'video/mp4', duracaoS: 10 }, 60)).toMatch(/grande/)
    expect(conferirArquivo({ bytes: 10, tipo: 'image/png', duracaoS: 10 }, 60)).toMatch(/Formato/)
  })
})

describe('resumo por exercício', () => {
  // Datas pequenas nos dados: o relógio fica perto delas (nada passou do prazo de guarda).
  beforeEach(() => vi.useFakeTimers({ now: 1000, toFake: ['Date'] }))
  afterEach(() => vi.useRealTimers())
  it('orientação pronta mais recente vale para o exercício (próximos treinos); envio mais recente para o status', () => {
    const lista = [
      d({ id: 'o1', tipo: 'orientacao', prontoEm: ts(100) }),
      d({ id: 'o2', tipo: 'orientacao', prontoEm: ts(300) }),
      d({ id: 'o3', tipo: 'orientacao', status: 'enviando', prontoEm: null }),
      d({ id: 'e1', em: ts(50) }),
      d({ id: 'e2', em: ts(400), prontoEm: ts(410) }),
      d({ id: 'x', exercicioId: 'outro', tipo: 'orientacao', prontoEm: ts(999) }),
    ]
    const r = resumoPorExercicio(lista).get('supino-reto-barra')!
    expect(r.orientacao?.id).toBe('o2')
    expect(r.execucao?.id).toBe('e2')
    expect(situacaoExecucao(r)).toBe('aguardando')
  })
  it('situação: nada, enviando, aguardando, respondida (marcada ou orientação mais nova)', () => {
    expect(situacaoExecucao(undefined)).toBe('nada')
    expect(situacaoExecucao({ execucao: d({ status: 'enviando' }) })).toBe('enviando')
    expect(situacaoExecucao({ execucao: d({ prontoEm: ts(10) }) })).toBe('aguardando')
    expect(situacaoExecucao({ execucao: d({ prontoEm: ts(10), respondida: true }) })).toBe('respondida')
    expect(situacaoExecucao({ execucao: d({ prontoEm: ts(10) }), orientacao: d({ tipo: 'orientacao', prontoEm: ts(20) }) })).toBe('respondida')
    expect(situacaoExecucao({ execucao: d({ prontoEm: ts(30) }), orientacao: d({ tipo: 'orientacao', prontoEm: ts(20) }) })).toBe('aguardando')
  })
  it('sem resposta até o vídeo sair do ar (60 dias): libera novo envio e sai da fila do coach', () => {
    const dia = 86_400_000
    const agora = 100 * dia
    const velha = d({ id: 'v', prontoEm: ts(agora - 61 * dia) })
    const nova = d({ id: 'n', prontoEm: ts(agora - 59 * dia) })
    expect(situacaoExecucao({ execucao: velha }, agora)).toBe('expirada')
    expect(situacaoExecucao({ execucao: nova }, agora)).toBe('aguardando')
    expect(situacaoExecucao({ execucao: { ...velha, respondida: true } }, agora)).toBe('respondida')
    expect(filaDoCoach([velha, nova], agora).map((x) => x.id)).toEqual(['n'])
  })
  it('fila do coach: só execuções prontas sem resposta, mais antigas primeiro', () => {
    const f = filaDoCoach([
      d({ id: 'b', prontoEm: ts(20) }),
      d({ id: 'a', prontoEm: ts(10) }),
      d({ id: 'r', prontoEm: ts(5), respondida: true }),
      d({ id: 'e', status: 'enviando', em: ts(1) }),
      d({ id: 'o', tipo: 'orientacao', prontoEm: ts(1) }),
    ])
    expect(f.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('marcações', () => {
  const caneta: Marca = { t: 2, k: 'caneta', p: [0.1, 0.1, 0.5, 0.5] }
  const ponto: Marca = { t: 2.2, k: 'ponto', p: [0.8, 0.8] }
  it('limparMarcas descarta lixo, coordenada fora de 0..1, ímpar e excesso', () => {
    expect(limparMarcas([caneta, ponto])).toEqual([caneta, ponto])
    expect(limparMarcas([{ t: 1, k: 'ponto', p: [1.2, 0] }, { t: -1, k: 'ponto', p: [0, 0] }, { t: 1, k: 'x', p: [0, 0] }, { t: 1, k: 'caneta', p: [0, 0, 1] }, null, 'a'])).toEqual([])
    expect(limparMarcas(Array.from({ length: 310 }, () => ponto))).toHaveLength(300)
    expect(limparMarcas('x')).toEqual([])
  })
  it('aparecem no trecho em que foram feitas (±0,4 s) e geram os momentos para pular', () => {
    expect(marcasNoTempo([caneta, ponto], 2.1)).toEqual([caneta, ponto])
    expect(marcasNoTempo([caneta, ponto], 2.5)).toEqual([ponto])
    expect(marcasNoTempo([caneta, ponto], 3)).toEqual([])
    expect(momentosMarcados([ponto, caneta, { ...ponto, t: 2.04 }])).toEqual([2, 2.2])
  })
  it('borracha apaga só perto do toque e no mesmo instante', () => {
    expect(apagarPerto([caneta, ponto], 2, 0.5, 0.5)).toEqual([ponto])
    expect(apagarPerto([caneta, ponto], 5, 0.5, 0.5)).toEqual([caneta, ponto])
    expect(apagarPerto([caneta, ponto], 2, 0.3, 0.9)).toEqual([caneta, ponto])
  })
  it('simplificar tira pontos colados, mantém início e fim e arredonda', () => {
    const p = [0, 0, 0.001, 0.001, 0.002, 0.002, 0.5, 0.5, 0.50001, 0.5]
    expect(simplificar(p)).toEqual([0, 0, 0.5, 0.5, 0.5, 0.5])
  })
})
