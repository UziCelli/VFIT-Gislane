// Erro técnico de medição (ETM) das dobras e dos perímetros. Funções puras.
// Cada ponto pode ter 2 medidas na mesma avaliação; vale a média. ETM = √(Σd² / 2n) com os pares de todas as
// avaliações do aluno; ETM% = ETM ÷ média × 100. Tolerância usada (intra-avaliador, referência ISAK citada por
// Ulijaszek & Kerr 1999): dobras até 5%, perímetros até 1%. A menor mudança real (MMR, 95%) = 1,96 × √2 × ETM.
// Fontes: docs/evidencias-avaliacao.md e aba Referências.

export const TOLERANCIA = { dobra: 5, perimetro: 1 } as const // %
export const MIN_PARES = 5 // abaixo disso o ETM do aluno ainda não é confiável
const Z95 = 1.96 * Math.SQRT2

type Mapa = Partial<Record<string, number>>
export type MedidasDuplas = { dobras: Mapa; dobras2?: Mapa; perimetros: Mapa; perimetros2?: Mapa }

// Pares (1ª, 2ª medida) de um tipo, em todas as avaliações dadas.
export function pares(avs: MedidasDuplas[], tipo: 'dobras' | 'perimetros'): [number, number][] {
  const k2 = tipo === 'dobras' ? 'dobras2' : 'perimetros2'
  return avs.flatMap((a) => Object.entries(a[k2] ?? {}).flatMap(([id, b]) => (b != null && a[tipo][id] != null ? [[a[tipo][id]!, b] as [number, number]] : [])))
}

export type Etm = { abs: number; pct: number; n: number; dentro: boolean }
export function etm(ps: [number, number][], tipo: 'dobra' | 'perimetro'): Etm | null {
  if (!ps.length) return null
  const abs = Math.sqrt(ps.reduce((s, [a, b]) => s + (a - b) ** 2, 0) / (2 * ps.length))
  const media = ps.reduce((s, [a, b]) => s + a + b, 0) / (2 * ps.length)
  const pct = media > 0 ? (abs / media) * 100 : 0
  return { abs: Math.round(abs * 100) / 100, pct: Math.round(pct * 10) / 10, n: ps.length, dentro: pct <= TOLERANCIA[tipo] }
}

// Menor mudança real (mesma unidade da medida) para um valor, a partir do ETM% do aluno. Sem ETM confiável: null.
export const mudancaReal = (e: Etm | null, valor: number) => (e && e.n >= MIN_PARES ? (Z95 * e.pct * valor) / 100 : null)

// Média das duas medidas (a 2ª é opcional).
export function mediaDupla(a: Mapa, b: Mapa | undefined): Partial<Record<string, number>> {
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, b?.[k] != null && v != null ? Math.round(((v + b[k]!) / 2) * 10) / 10 : v]))
}

// Pontos desta avaliação em que as 2 medidas diferem além da tolerância (pede a 3ª medida).
export function foraDaTolerancia(a: Mapa, b: Mapa | undefined, tipo: 'dobra' | 'perimetro') {
  return Object.entries(b ?? {}).flatMap(([id, y]) => {
    const x = a[id]
    if (x == null || y == null) return []
    const dif = (Math.abs(x - y) / ((x + y) / 2)) * 100
    return dif > TOLERANCIA[tipo] ? [{ id, a: x, b: y, pct: Math.round(dif) }] : []
  })
}
