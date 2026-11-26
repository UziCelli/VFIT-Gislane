import { describe, expect, it } from 'vitest'
import { assinar, conferir, faixa, faltando, idOk, LINK_MS, lerCampos, lerMidia, limitarFaixa, marcarPronto, MAX_BYTES, MAX_RESPOSTA, PARTE, partesDe, retomar, tamanhoParte, validarInicio, type Meta } from './midia'

const ID = 'AbCdEfGhIjKlMnOpQrSt'
const chave = () => crypto.subtle.importKey('raw', new Uint8Array(32).fill(7), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

describe('validarInicio', () => {
  it('aceita id de 20 letras/números, tamanho até 50 MB e vídeo mp4/webm/mov', () => {
    expect(validarInicio({ id: ID, bytes: 1000, mime: 'video/mp4' })).toEqual({ id: ID, bytes: 1000, mime: 'video/mp4' })
    expect(validarInicio({ id: ID, bytes: MAX_BYTES, mime: 'video/quicktime' })).not.toBeNull()
  })
  it('recusa id estranho, tamanho 0/fracionado/grande demais e tipo que não é vídeo', () => {
    for (const c of [
      { id: '../x', bytes: 10, mime: 'video/mp4' },
      { id: ID, bytes: 0, mime: 'video/mp4' },
      { id: ID, bytes: 1.5, mime: 'video/mp4' },
      { id: ID, bytes: MAX_BYTES + 1, mime: 'video/mp4' },
      { id: ID, bytes: 10, mime: 'text/html' },
      null,
    ])
      expect(validarInicio(c)).toBeNull()
  })
  it('idOk', () => {
    expect(idOk(ID)).toBe(true)
    expect(idOk(ID + 'a')).toBe(false)
    expect(idOk('AbCdEfGhIjKlMnOpQr/t')).toBe(false)
  })
})

describe('partes', () => {
  it('divide em partes de 1 MiB; a última pode ser menor', () => {
    expect(partesDe(1)).toBe(1)
    expect(partesDe(PARTE)).toBe(1)
    expect(partesDe(PARTE + 1)).toBe(2)
    expect(tamanhoParte(PARTE + 10, 0)).toBe(PARTE)
    expect(tamanhoParte(PARTE + 10, 1)).toBe(10)
  })
  it('faltando: retomar envia só o que não chegou', () => {
    expect(faltando({ partes: 4, recebidas: [0, 2] })).toEqual([1, 3])
    expect(faltando({ partes: 2, recebidas: [1, 0] })).toEqual([])
  })
})

describe('faixa (Range)', () => {
  it('sem Range = arquivo inteiro', () => expect(faixa(null, 100)).toBeNull())
  it('formatos aceitos', () => {
    expect(faixa('bytes=0-9', 100)).toEqual({ inicio: 0, fim: 9 })
    expect(faixa('bytes=90-', 100)).toEqual({ inicio: 90, fim: 99 })
    expect(faixa('bytes=-10', 100)).toEqual({ inicio: 90, fim: 99 })
    expect(faixa('bytes=50-500', 100)).toEqual({ inicio: 50, fim: 99 })
  })
  it('inválidos = 416', () => {
    for (const r of ['bytes=100-', 'bytes=5-1', 'bytes=-0', 'bytes=-', 'items=0-1', 'bytes=0-1,3-4']) expect(faixa(r, 100)).toBe('invalida')
  })
  it('resposta limitada a 8 MiB', () => expect(limitarFaixa({ inicio: 0, fim: 50 * PARTE })).toEqual({ inicio: 0, fim: MAX_RESPOSTA - 1 }))
})

describe('link assinado', () => {
  it('confere projeto, id e validade; recusa adulterado, vencido ou longo demais', async () => {
    const k = await chave()
    const agora = 1_000_000
    const exp = agora + LINK_MS
    const sig = await assinar(k, 'forca--app', ID, exp)
    expect(await conferir(k, 'forca--app', ID, String(exp), sig, agora)).toBe('forca--app')
    // outra marca, outro vídeo, validade mexida, vencido, além de 10 min
    expect(await conferir(k, 'gislane-personal-trainer', ID, String(exp), sig, agora)).toBeNull()
    expect(await conferir(k, 'forca--app', 'ZbCdEfGhIjKlMnOpQrSt', String(exp), sig, agora)).toBeNull()
    expect(await conferir(k, 'forca--app', ID, String(exp - 1), sig, agora)).toBeNull()
    expect(await conferir(k, 'forca--app', ID, String(exp), sig, exp + 1)).toBeNull()
    const longe = agora + LINK_MS + 1
    expect(await conferir(k, 'forca--app', ID, String(longe), await assinar(k, 'forca--app', ID, longe), agora)).toBeNull()
    expect(await conferir(k, 'forca--app', ID, String(exp), 'lixo!', agora)).toBeNull()
  })
})

describe('Firestore com o token de quem chama', () => {
  const campos = { alunoId: { stringValue: 'ana' }, autor: { stringValue: 'ana' }, tipo: { stringValue: 'execucao' }, status: { stringValue: 'enviando' }, bytes: { integerValue: '123' } }
  it('lerCampos exige tipo, uids e bytes', () => {
    expect(lerCampos(campos)).toEqual({ alunoId: 'ana', autor: 'ana', tipo: 'execucao', status: 'enviando', bytes: 123 })
    expect(lerCampos({ ...campos, tipo: { stringValue: 'foto' } })).toBe(false)
    expect(lerCampos({ ...campos, autor: { stringValue: 'a/b' } })).toBe(false)
  })
  it('lerMidia: 403/404 = sem permissão; 500/rede = não sabe; usa o token e o projeto do pedido', async () => {
    const urls: string[] = []
    const ok = (async (u: string, i: RequestInit) => {
      urls.push(`${u} ${(i.headers as Record<string, string>).Authorization}`)
      return Response.json({ fields: campos })
    }) as unknown as typeof fetch
    expect(await lerMidia('gislane-personal-trainer', ID, 'tok', ok)).toMatchObject({ alunoId: 'ana' })
    expect(urls[0]).toBe(`https://firestore.googleapis.com/v1/projects/gislane-personal-trainer/databases/(default)/documents/midias/${ID} Bearer tok`)
    for (const [s, esperado] of [[403, false], [404, false], [500, null]] as const)
      expect(await lerMidia('forca--app', ID, 'tok', (async () => new Response('', { status: s })) as unknown as typeof fetch)).toBe(esperado)
    expect(await lerMidia('forca--app', ID, 'tok', (async () => { throw new Error('rede') }) as unknown as typeof fetch)).toBeNull()
  })
  it('marcarPronto grava só status com a hora do servidor e exige o documento', async () => {
    let corpo: any
    const f = (async (_u: string, i: RequestInit) => ((corpo = JSON.parse(i.body as string)), new Response('{}'))) as unknown as typeof fetch
    expect(await marcarPronto('forca--app', ID, 'tok', f)).toBe(true)
    const w = corpo.writes[0]
    expect(w.updateMask.fieldPaths).toEqual(['status'])
    expect(w.update.fields).toEqual({ status: { stringValue: 'pronto' } })
    expect(w.updateTransforms).toEqual([{ fieldPath: 'prontoEm', setToServerValue: 'REQUEST_TIME' }])
    expect(w.currentDocument).toEqual({ exists: true })
    expect(await marcarPronto('forca--app', ID, 'tok', (async () => new Response('', { status: 403 })) as unknown as typeof fetch)).toBe(false)
  })
})

describe('retomar envio', () => {
  const meta = (x: Partial<Meta>): Meta => ({
    projeto: 'forca--app', id: ID, autor: 'ana', alunoId: 'ana', tipo: 'execucao', bytes: 3 * PARTE, mime: 'video/mp4',
    partes: 3, recebidas: [0], criadoEm: 0, completo: false, avisado: false, ...x,
  })
  it('mesmo arquivo do mesmo autor devolve só as partes que faltam', () => {
    expect(retomar(meta({}), { autor: 'ana', bytes: 3 * PARTE, mime: 'video/mp4' })).toEqual({ faltam: [1, 2] })
  })
  it('já completo: nada a reenviar, o app só repete a confirmação', () => {
    expect(retomar(meta({ recebidas: [0, 1, 2], completo: true }), { autor: 'ana', bytes: 3 * PARTE, mime: 'video/mp4' })).toEqual({ faltam: [] })
  })
  it('outro autor, tamanho ou formato é outro arquivo', () => {
    expect(retomar(meta({}), { autor: 'bia', bytes: 3 * PARTE, mime: 'video/mp4' })).toBe('conflito')
    expect(retomar(meta({}), { autor: 'ana', bytes: 2 * PARTE, mime: 'video/mp4' })).toBe('conflito')
    expect(retomar(meta({}), { autor: 'ana', bytes: 3 * PARTE, mime: 'video/webm' })).toBe('conflito')
  })
})
