// Aparelhos e o catálogo de máquinas sem etiqueta de peso. Funções puras. Plano: docs/plano-aparelhos.md.
// 1ª versão (24/11/2026): só o modelo e as contas. Nada aqui é gravado no Firestore nem usado pelas telas ainda.
//
// Convenção do valor anotado:
// - aparelho em kg: o número lido no aparelho (etiqueta/anilha), como o aluno já anota hoje;
// - aparelho em nível: o NÚMERO DO NÍVEL (1, 2, 3...). O kg do nível é sempre estimativa.
// Polia 2:1: a etiqueta marca o peso da pilha, mas o aluno puxa cerca da metade (`kgSentido`).
// Suposições marcadas (SUPOSIÇÃO) devem ser confirmadas pelo coach.

export type TipoAparelho = 'halter' | 'barra' | 'maquina' | 'articulada' | 'polia' | 'duasPolias'
export type Unidade = 'kg' | 'nivel'
export type RazaoPolia = '1:1' | '2:1'

interface AparelhoBase {
  id: string // estável, sem espaço (ex.: 'cond-x-extensora')
  nome: string // ex.: 'Cadeira extensora'
  local: string // academia ou condomínio; item de modelo de fábrica (molde) usa 'modelo'
  fabricante?: string // ex.: 'Movement', 'Life Fitness'
  modelo?: string // ex.: 'W4'
  tipo: TipoAparelho
  polia?: RazaoPolia // só polias; sem valor = 1:1
  porLado?: boolean // carga anotada por lado (articulada, halter)
  obs?: string
}

export interface AparelhoKg extends AparelhoBase {
  unidade: 'kg'
  incremento: number // de quanto em quanto sobe (ex.: 2.5, 5)
  minimo?: number // menor carga possível; sem valor = um incremento
  maximo?: number
  // Plaquinhas que somam por cima do degrau, cada uma 1 vez (ex.: Life Fitness [0.625, 0.625]: 11,25 → 11,875 → 12,5 → 13,75).
  complementos?: number[]
}

export interface AparelhoNivel extends AparelhoBase {
  unidade: 'nivel'
  niveis: number // quantidade de níveis (1..niveis)
  // kg ESTIMADO da pilha em cada nível: índice = nível - 1; null = não sei. Lista menor que `niveis` é permitida.
  kgNivel?: (number | null)[]
}

export type Aparelho = AparelhoKg | AparelhoNivel

// O que vai para o treino do aluno (#261): só a escala e um rótulo. Sem `local`, `obs`, fabricante/modelo nem o id do
// catálogo (que é do coach). `ref` = identidade opaca da máquina física, nunca reaproveitada; `nome` = rótulo do aluno.
type SemPrivado<T> = T extends unknown ? Omit<T, 'id' | 'local' | 'obs' | 'fabricante' | 'modelo'> : never
export type MaquinaTreino = SemPrivado<Aparelho> & { ref: string }

const TIPOS: readonly TipoAparelho[] = ['halter', 'barra', 'maquina', 'articulada', 'polia', 'duasPolias']
const arred = (x: number) => Math.round(x * 1000) / 1000
const positivo = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0

// Peso que o aluno de fato move a partir do kg da etiqueta (polia 2:1 = metade). Serve para comparar aparelhos.
export const kgSentido = (ap: Aparelho, kgEtiqueta: number) => (ap.polia === '2:1' ? arred(kgEtiqueta / 2) : kgEtiqueta)

// Somas possíveis das plaquinhas complementares (cada uma usada no máximo 1 vez), com 0. Ex.: [0.625, 0.625] → 0, 0.625, 1.25.
function somasComplementos(c: number[] = []): number[] {
  let somas = [0]
  for (const x of c) somas = [...somas, ...somas.map((s) => arred(s + x))]
  return [...new Set(somas)].sort((a, b) => a - b)
}

// Cargas que existem no aparelho em kg perto de `valor`: degraus da pilha (mínimo + n × incremento, até o máximo)
// mais as plaquinhas complementares (ex.: Life Fitness 0,625 kg).
function cargasPerto(ap: AparelhoKg, valor: number): number[] {
  const min = ap.minimo ?? ap.incremento
  const out = new Set<number>()
  // Para cada soma de plaquinhas, os degraus perto de (valor - soma): plaquinha maior que o incremento alcança degraus abaixo.
  for (const s of somasComplementos(ap.complementos)) {
    // Último degrau que, com esta soma, não passa do máximo (máximo fora da grade: 5 em 5 até 12 para no 10).
    const ultimo = ap.maximo != null ? Math.floor((ap.maximo - s - min) / ap.incremento + 1e-9) : Infinity
    if (ultimo < 0) continue
    const p0 = Math.floor((valor - s - min) / ap.incremento)
    for (let p = p0 - 1; p <= p0 + 2; p++) out.add(arred(min + Math.min(Math.max(0, p), ultimo) * ap.incremento + s))
  }
  return [...out].sort((a, b) => a - b)
}

// Valor válido mais próximo no aparelho: carga que existe (kg) ou nível inteiro, dentro dos limites.
// Empate sobe, como o Math.round do arredondamento padrão do app.
export function arredondarNoAparelho(ap: Aparelho, valor: number): number {
  if (ap.unidade === 'nivel') return Math.min(ap.niveis, Math.max(1, Math.round(valor)))
  let melhor = ap.minimo ?? ap.incremento
  let dist = Infinity
  for (const kg of cargasPerto(ap, valor)) {
    const d = Math.abs(kg - valor)
    if (d <= dist + 1e-9) {
      melhor = kg
      dist = d
    }
  }
  return melhor
}

// Próximo valor acima (+1) ou abaixo (-1); null se já está no limite. Com plaquinhas, anda uma plaquinha por vez.
export function proximoValor(ap: Aparelho, valor: number, direcao: 1 | -1): number | null {
  const atual = arredondarNoAparelho(ap, valor)
  if (ap.unidade === 'nivel') {
    const novo = atual + direcao
    return novo < 1 || novo > ap.niveis ? null : novo
  }
  const lista = cargasPerto(ap, atual)
  const novo = direcao > 0 ? lista.find((kg) => kg > atual + 1e-9) : [...lista].reverse().find((kg) => kg < atual - 1e-9)
  return novo ?? null
}

// kg estimado de um nível. Nível sem kg anotado, entre dois anotados: interpola em linha reta (SUPOSIÇÃO: a pilha sobe
// por igual entre eles). Fora dos anotados ou sem dado: null (não inventa).
export function kgDoNivel(ap: AparelhoNivel, nivel: number): number | null {
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > ap.niveis) return null
  const kg = ap.kgNivel ?? []
  const exato = kg[nivel - 1]
  if (exato != null) return exato
  let a = -1
  let b = -1
  for (let i = nivel - 2; i >= 0; i--) if (kg[i] != null) { a = i; break }
  for (let i = nivel; i < kg.length; i++) if (kg[i] != null) { b = i; break }
  if (a < 0 || b < 0) return null
  const ka = kg[a]!
  const kb = kg[b]!
  return arred(ka + ((kb - ka) * (nivel - 1 - a)) / (b - a))
}

// Nível cujo kg estimado fica mais perto do kg pedido (sugestão do motor). Empate: o nível mais pesado (igual ao Math.round).
// null se nenhum nível tem kg estimado.
export function nivelParaKg(ap: AparelhoNivel, kg: number): number | null {
  let melhor: number | null = null
  let dist = Infinity
  for (let n = 1; n <= ap.niveis; n++) {
    const k = kgDoNivel(ap, n)
    if (k == null) continue
    const d = Math.abs(k - kg)
    if (d <= dist + 1e-9) {
      melhor = n
      dist = d
    }
  }
  return melhor
}

// Sugestão de kg do motor traduzida para o aparelho: valor a mostrar ao aluno + kg que ele representa.
// Aparelho em nível sem kg estimado: null (o coach sugere o nível na mão).
export function sugestaoNoAparelho(ap: Aparelho, kgSugerido: number): { valor: number; kg: number; estimado: boolean } | null {
  if (!positivo(kgSugerido)) return null
  if (ap.unidade === 'kg') {
    const v = arredondarNoAparelho(ap, kgSugerido)
    return { valor: v, kg: v, estimado: false }
  }
  const n = nivelParaKg(ap, kgSugerido)
  return n == null ? null : { valor: n, kg: kgDoNivel(ap, n)!, estimado: true }
}

// kg que um valor anotado representa (para as contas de progressão). Nível sem estimativa: null.
export function kgAnotado(ap: Aparelho, valor: number): number | null {
  if (!positivo(valor)) return null
  return ap.unidade === 'kg' ? valor : kgDoNivel(ap, valor)
}

// kg estimado de cada nível de uma pilha comum: o nível 1 é a placa do topo (mais leve, às vezes com a barra/pino) e cada
// nível seguinte soma uma placa. `placas` pode variar ao longo da pilha (ex.: [5, 5, 5, 10, 10]).
export function kgDaPilha(topo: number, placas: number | number[], niveis?: number): number[] {
  const lista = Array.isArray(placas) ? placas : Array.from({ length: Math.max(0, (niveis ?? 1) - 1) }, () => placas)
  const kg = [arred(topo)]
  for (const p of lista) kg.push(arred(kg[kg.length - 1] + p))
  return kg
}

// Volume (kg x reps) e carga média de séries anotadas em NÍVEL ou kg. Série sem kg estimado fica de fora e é contada
// em `semKg`, para a tela avisar que o volume está incompleto.
export function volumeNoAparelho(ap: Aparelho, valores: (number | null)[], reps: (number | null)[]) {
  let volume = 0
  let somaKg = 0
  let series = 0
  let semKg = 0
  valores.forEach((v, i) => {
    const r = reps[i]
    if (v == null || !(v > 0)) return
    const kg = kgAnotado(ap, v)
    if (kg == null) {
      semKg++
      return
    }
    series++
    somaKg += kg
    if (r != null && r > 0) volume += kg * r
  })
  return { volume: arred(volume), cargaMedia: series ? arred(somaKg / series) : null, series, semKg }
}

// Confere um item do catálogo (dado digitado à mão). Devolve a lista de problemas; vazia = ok.
export function problemasAparelho(x: unknown): string[] {
  if (typeof x !== 'object' || x == null) return ['não é um objeto']
  const a = x as Record<string, unknown>
  const p: string[] = []
  const texto = (k: string) => typeof a[k] === 'string' && (a[k] as string).trim() !== ''
  if (!texto('id') || /\s/.test(String(a.id))) p.push('id vazio ou com espaço')
  if (!texto('nome')) p.push('sem nome')
  if (!texto('local')) p.push('sem local')
  if (!TIPOS.includes(a.tipo as TipoAparelho)) p.push('tipo desconhecido')
  if (a.polia != null && a.polia !== '1:1' && a.polia !== '2:1') p.push('polia deve ser 1:1 ou 2:1')
  if (a.polia != null && a.tipo !== 'polia' && a.tipo !== 'duasPolias') p.push('polia só em aparelho de polia')
  if (a.unidade === 'kg') {
    if (!positivo(a.incremento)) p.push('incremento deve ser maior que 0')
    if (a.minimo != null && !positivo(a.minimo)) p.push('mínimo deve ser maior que 0')
    if (a.maximo != null && !positivo(a.maximo)) p.push('máximo deve ser maior que 0')
    const menor = a.minimo ?? a.incremento // sem mínimo, a menor carga é um incremento
    if (positivo(menor) && positivo(a.maximo) && a.maximo < menor) p.push('máximo menor que a menor carga')
    const c = a.complementos
    if (c != null && (!Array.isArray(c) || c.length > 4 || c.some((x) => !positivo(x)))) p.push('complementos: até 4 plaquinhas maiores que 0')
  } else if (a.unidade === 'nivel') {
    if (!Number.isInteger(a.niveis) || (a.niveis as number) < 1) p.push('níveis deve ser inteiro de 1 para cima')
    const kg = a.kgNivel
    if (kg != null) {
      if (!Array.isArray(kg) || kg.length > (a.niveis as number)) p.push('kgNivel maior que o número de níveis')
      else if (kg.some((k) => k != null && !positivo(k))) p.push('kgNivel com valor inválido')
      else {
        const conhecidos = kg.filter((k): k is number => k != null)
        if (conhecidos.some((k, i) => i > 0 && k <= conhecidos[i - 1])) p.push('kgNivel deve subir a cada nível')
      }
    }
  } else p.push('unidade deve ser kg ou nivel')
  return p
}
