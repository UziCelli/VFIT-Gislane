// Valores da API REST do Firestore <-> JS puro. Sem dependências: roda no Worker e no Vitest.
// Timestamp vira Ts (tem toMillis, como o do SDK), então lerAnamnese/lerAvaliacao/lerDor/lerCheckin servem sem mudança.
export class Ts {
  constructor(readonly ms: number) {}
  toMillis() {
    return this.ms
  }
}

export type ValorRest = Record<string, unknown>

export function deRest(v: unknown): unknown {
  const x = (v ?? {}) as ValorRest
  if ('nullValue' in x) return null
  if ('booleanValue' in x) return x.booleanValue === true
  if ('integerValue' in x) return Number(x.integerValue)
  if ('doubleValue' in x) return Number(x.doubleValue)
  if ('stringValue' in x) return String(x.stringValue)
  if ('timestampValue' in x) {
    const ms = Date.parse(String(x.timestampValue))
    return Number.isNaN(ms) ? null : new Ts(ms)
  }
  if ('arrayValue' in x) return ((x.arrayValue as { values?: unknown[] }).values ?? []).map(deRest)
  if ('mapValue' in x) return docDeRest((x.mapValue as { fields?: Record<string, unknown> }).fields)
  if ('referenceValue' in x) return String(x.referenceValue)
  return null // bytes, geopoint: o app não usa
}

export const docDeRest = (fields: Record<string, unknown> | undefined): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, deRest(v)]))

// Id do documento = último pedaço de `name`.
export const idDeRest = (name: string) => name.slice(name.lastIndexOf('/') + 1)

export function paraRest(v: unknown): ValorRest {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Ts) return { timestampValue: new Date(v.ms).toISOString() }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(paraRest) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, paraRest(x)])) } }
}
