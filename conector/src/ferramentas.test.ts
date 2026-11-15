import { describe, expect, it } from 'vitest'
import { mesoPadrao } from '../../src/features/coach/meso/mesoPadrao'
import { mesoParaDoc } from '../../src/lib/conversores'
import { executar } from './execucao'
import { catalogoExercicios, listarAlunos, resumirCargas, verAluno, verMesos } from './ferramentas'
import { Firestore } from './firestore'
import { paraRest, Ts } from './rest'

const HOJE = new Date('2026-11-12T15:00:00Z')
const SLOT = { slotId: 'sx1', nome: 'Supino Reto Barra' }
const meso = (inicio: string) => {
  const p = mesoPadrao()
  return { alunoId: 'al1', nome: `Meso ${inicio}`, ...mesoParaDoc({ ...p, inicio, divisao: [[SLOT], [], []] }) }
}
const base = 'projects/forca--app/databases/(default)/documents'

// Banco falso: coleção -> docs. Atende GET de documento e :runQuery com um filtro de igualdade.
function banco(colecoes: Record<string, Record<string, object>>, negar = false) {
  const chamadas: { url: string; auth: string | null }[] = []
  const buscar = (async (url: string, init: RequestInit = {}) => {
    chamadas.push({ url, auth: new Headers(init.headers).get('Authorization') })
    if (negar) return new Response('{}', { status: 403 })
    const campos = (o: object) => (paraRest(o) as { mapValue: { fields: object } }).mapValue.fields
    if (url.endsWith(':runQuery')) {
      const q = JSON.parse(String(init.body)).structuredQuery
      const f = q.where?.fieldFilter
      const docs = Object.entries(colecoes[q.from[0].collectionId] ?? {}).filter(([, d]) => !f || (d as Record<string, unknown>)[f.field.fieldPath] === f.value.stringValue)
      return Response.json(docs.length ? docs.map(([id, d]) => ({ document: { name: `${base}/${q.from[0].collectionId}/${id}`, fields: campos(d) } })) : [{ readTime: 'x' }])
    }
    const [col, id] = url.split('/documents/')[1].split('/')
    const d = colecoes[col]?.[id]
    return d ? Response.json({ name: `${base}/${col}/${id}`, fields: campos(d) }) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return { fs: new Firestore('forca--app', 'tok', buscar), chamadas, buscar }
}

const dados = {
  usuarios: {
    al1: { papel: 'aluno', nome: 'Ana', status: 'ativo', email: 'ana@x.com', pagoAte: new Ts(Date.parse('2026-12-05T15:00:00Z')), pesoKg: 60 },
    al2: { papel: 'aluno', nome: 'Bia', status: 'aguardando' },
    coach1: { papel: 'coach', nome: 'Victor' },
  },
  mesos: { m1: meso('2026-11-02'), m2: meso('2026-12-01'), mx: { ...meso('2026-11-02'), alunoId: 'al2' } },
}

describe('listar_alunos', () => {
  it('só alunos, em ordem, com meso atual, fim e se tem próximo', async () => {
    const r = await listarAlunos(banco(dados).fs, HOJE)
    expect(r.map((a) => a.nome)).toEqual(['Ana', 'Bia'])
    expect(r[0]).toMatchObject({ id: 'al1', status: 'ativo', pagoAte: '2026-12-05', temProximo: true, mesoAtual: { id: 'm1', semana: 2, de: 4, inicio: '2026-11-02', estado: 'durante' } })
    expect(r[1]).toMatchObject({ pagoAte: null, temProximo: false })
    expect(JSON.stringify(r)).not.toContain('ana@x.com') // sem e-mail na lista
  })
  it('aluno cujo meso só começa no futuro não tem meso atual', async () => {
    const r = await listarAlunos(banco({ ...dados, mesos: { m2: meso('2026-12-01') } }).fs, HOJE)
    expect(r[0]).toMatchObject({ mesoAtual: null, temProximo: true })
  })
  it('meso com dado quebrado é ignorado, não derruba a lista', async () => {
    const r = await listarAlunos(banco({ ...dados, mesos: { ruim: { alunoId: 'al1', inicio: '2026-11-02' } } }).fs, HOJE)
    expect(r[0].mesoAtual).toBeNull()
  })
  it('usa o token do coach em cada chamada', async () => {
    const b = banco(dados)
    await listarAlunos(b.fs, HOJE)
    expect(b.chamadas.every((c) => c.auth === 'Bearer tok')).toBe(true)
  })
})

describe('ver_aluno', () => {
  const ts = (s: string) => new Ts(Date.parse(s))
  const completo = {
    ...dados,
    anamneses: {
      a1: { alunoId: 'al1', versao: 1, origem: 'aluno', em: ts('2026-10-01T10:00:00Z'), r: { dores: ['ombro'], coracao: true }, obsCoach: 'cuidado' },
      a0: { alunoId: 'al1', versao: 1, origem: 'aluno', em: ts('2026-01-01T10:00:00Z'), r: {} },
    },
    avaliacoes: {
      v1: { alunoId: 'al1', data: '2026-09-01', pesoKg: 62, perimetros: {}, dobras: {}, bio: {}, comentario: '', liberado: true },
      v2: { alunoId: 'al1', data: '2026-11-01', pesoKg: 60, perimetros: { cintura: 70 }, dobras: {}, bio: {}, comentario: '', liberado: false },
    },
    notas: { al1: { exercicios: { 'Supino Reto Barra': 'ombro incomoda' } } },
    fisioDores: { d1: { alunoId: 'al1', exercicio: 'Supino', articulacao: 'ombro', tipo: 'dor', intensidade: 4, momento: 'durante', texto: 'fisgada', em: ts('2026-11-10T10:00:00Z') } },
    fisioCheckins: { c1: { alunoId: 'al1', mesoId: 'm1', semana: 2, treino: 1, sono: 3, estresse: 2, cansaco: 4, alimentacao: 3, em: ts('2026-11-10T11:00:00Z') } },
  }
  it('junta perfil, anamnese mais recente, última avaliação, notas, dores e check-ins', async () => {
    const r = await verAluno(banco(completo).fs, 'al1')
    expect(r.perfil).toEqual({ id: 'al1', nome: 'Ana', status: 'ativo', pagoAte: '2026-12-05', pesoKg: 60 })
    expect(r.anamnese).toMatchObject({ origem: 'aluno', pausadoPorSaude: true, obsCoach: 'cuidado' })
    expect(r.anamnese?.sinaisDeAtencao.length).toBeGreaterThan(0)
    expect(r.ultimaAvaliacao).toMatchObject({ id: 'v2', pesoKg: 60 })
    expect(r.notasDoAluno).toEqual({ 'Supino Reto Barra': 'ombro incomoda' })
    expect(r.dores[0]).toMatchObject({ exercicio: 'Supino', local: 'ombro', intensidade: 4, em: '2026-11-10T10:00:00.000Z' })
    expect(r.checkins[0]).toMatchObject({ sono: 3, semana: 2, treino: 1, dor24h: null })
  })
  it('aluno sem nada devolve vazios', async () => {
    const r = await verAluno(banco(dados).fs, 'al2')
    expect(r).toMatchObject({ anamnese: null, ultimaAvaliacao: null, notasDoAluno: {}, dores: [], checkins: [] })
  })
  it('recusa id inválido, inexistente ou que não é aluno', async () => {
    const { fs } = banco(dados)
    await expect(verAluno(fs, '../x')).rejects.toThrow('inválido')
    await expect(verAluno(fs, 'nao')).rejects.toThrow('não encontrado')
    await expect(verAluno(fs, 'coach1')).rejects.toThrow('não encontrado')
  })
})

describe('ver_mesos', () => {
  const m1 = { ...meso('2026-11-02') }
  // 1º treino, 1ª semana: exercício da posição 1.
  const slot1 = SLOT.slotId
  const registros = {
    [`m1_s01_t1`]: { alunoId: 'al1', mesoId: 'm1', semana: 1, treino: 1, realizado: true, cargas: { [slot1]: { s1: 40, s2: 42 } }, reps: { [slot1]: { s1: 10, s2: 8 } } },
    // Registro do outro meso (m2) não entra no m1.
    [`m2_s01_t1`]: { alunoId: 'al1', mesoId: 'm2', semana: 1, treino: 1, cargas: { [slot1]: { s1: 99 } } },
  }
  it('meso com treinos, prescrito por semana e carga×reps registradas', async () => {
    const r = await verMesos(banco({ ...dados, mesos: { m1, m2: meso('2026-12-01') }, registros }).fs, 'al1', undefined, HOJE)
    expect(r.map((m) => [m.id, m.situacao])).toEqual([['m2', 'proximo'], ['m1', 'atual']])
    const atual = r[1]
    expect(atual).toMatchObject({ semanas: 4, treinosConcluidos: ['1-1'] })
    const ex = atual.treinos[0].exercicios[0]
    expect(ex.semanas).toHaveLength(4)
    expect(ex.semanas[0]).toMatchObject({ s: 1, feito: expect.stringMatching(/^40×10 42×8/) })
    expect(ex.semanas[0].prescrito).toMatch(/^\d+x /)
    expect(ex.semanas[1].feito).toBeUndefined()
    expect(JSON.stringify(atual)).not.toContain('99') // cada meso mostra só os próprios registros
    expect(r[0].treinos[0].exercicios[0].semanas[0].feito).toBe('99×-')
  })
  it('mesoId filtra um só', async () => {
    const r = await verMesos(banco({ ...dados, mesos: { m1, m2: meso('2026-12-01') }, registros }).fs, 'al1', 'm2', HOJE)
    expect(r.map((m) => m.id)).toEqual(['m2'])
  })
})

describe('resumirCargas', () => {
  it('série, drop e vazio', () => {
    expect(resumirCargas([40, null, 20], [10, 8, 12], 2)).toBe('40×10 -×8 D20×12')
    expect(resumirCargas([30], [null], 1, 's')).toBe('30×-s')
    expect(resumirCargas([null], [null], 1)).toBe('')
    expect(resumirCargas(undefined, undefined, 3)).toBe('')
  })
})

describe('catalogo_exercicios', () => {
  it('nomes por grupo e os métodos', () => {
    const c = catalogoExercicios()
    expect(c.grupos[0].exercicios).toContain('Agachamento Livre Barra')
    expect(c.metodos).toContain('Rest-pause')
  })
})

describe('executar (formato da resposta)', () => {
  const cfg = (buscar: typeof fetch, refreshToken: unknown = 'r') => ({ refreshToken, apiKey: 'k', projeto: 'forca--app', buscar })
  it('troca o refreshToken e devolve o JSON da leitura como texto', async () => {
    const urls: string[] = []
    const buscar = (async (u: string) => (urls.push(u), Response.json({ id_token: 'novo' }))) as typeof fetch
    const r = await executar(cfg(buscar), async (fs) => ({ ok: fs instanceof Firestore }))
    expect(r).toEqual({ content: [{ type: 'text', text: '{"ok":true}' }] })
    expect(urls[0]).toContain('securetoken.googleapis.com')
  })
  it('refresh recusado ou sem refreshToken = pede para conectar de novo', async () => {
    const r = await executar(cfg((async () => Response.json({ error: { message: 'INVALID_REFRESH_TOKEN' } }, { status: 400 })) as typeof fetch), async () => 1)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toContain('conectar')
    expect((await executar({ ...cfg(fetch), refreshToken: undefined }, async () => 1)).isError).toBe(true)
  })
  it('Firestore negando vira a mensagem de reconectar; erro desconhecido não vaza detalhe', async () => {
    const b = banco(dados, true)
    const negado = await executar(cfg((async (u: string, i?: RequestInit) => (String(u).includes('securetoken') ? Response.json({ id_token: 't' }) : b.buscar(u, i))) as typeof fetch), (fs) => listarAlunos(fs))
    expect(negado.content[0].text).toContain('conectar')
    const estranho = await executar(cfg((async () => Response.json({ id_token: 't' })) as typeof fetch), async () => { throw new Error('segredo-do-aluno') })
    expect(estranho.content[0].text).toBe('Erro inesperado no conector.')
  })
})

describe('renovação do Firebase', () => {
  it('envia o domínio autorizado junto com a chave pública', async () => {
    let cabecalhos: Headers | undefined
    const buscar = (async (_url: string, init?: RequestInit) => {
      cabecalhos = new Headers(init?.headers)
      return Response.json({ id_token: 'token' })
    }) as typeof fetch
    await executar({ refreshToken: 'refresh', apiKey: 'chave', projeto: 'forca--app', buscar }, async () => ({}))
    expect(cabecalhos?.get('referer')).toBe('https://app.vfitcoachapp.com/')
  })
})
