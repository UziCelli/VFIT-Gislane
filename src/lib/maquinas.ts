// Catálogo de máquinas do coach (épico #255, etapa 5 #260). Funções puras.
// Firestore: maquinas/{id} = Aparelho (src/engine/aparelho.ts, sem `id`) + { exercicios, por, em }.
// Não é um segundo catálogo: o modelo e as contas são os de aparelho.ts; aqui só o cadastro, a conferência e o vínculo.
// Identidade física (tipo + escala: degraus, níveis, plaquinhas, polia, por lado) fica separada de fabricante/modelo,
// que são só rótulos: duas seletoras do mesmo modelo em academias diferentes são máquinas diferentes (cada uma com o
// próprio id e, na etapa 7, a própria progressão). O id não muda ao editar: a série gravada (etapa 6) aponta para ele.
// `exercicios` guarda ids do catálogo base (ex.: 'cadeira-extensora') ou de exerciciosProprios ('p-...').
import { exercicioPorId, resolverExercicio } from '../data/catalogo'
import { kgDaPilha, problemasAparelho, type Aparelho, type RazaoPolia, type TipoAparelho, type Unidade } from '../engine/aparelho'
import type { Meso } from '../engine/tipos'
import { proprioPorNome, proprios } from './catalogoProprio'

export type TipoMaquina = Extract<TipoAparelho, 'maquina' | 'articulada' | 'polia' | 'duasPolias'>
export const TIPOS_MAQUINA: readonly { id: TipoMaquina; rotulo: string; apoio: string }[] = [
  { id: 'maquina', rotulo: 'Seletora', apoio: 'pinos' },
  { id: 'articulada', rotulo: 'Articulada', apoio: 'anilhas' },
  { id: 'polia', rotulo: 'Polia', apoio: 'cabo' },
  { id: 'duasPolias', rotulo: 'Duas Polias', apoio: 'crossover' },
]
export const LIMITES = { nome: 60, local: 60, rotulo: 40, obs: 200, exercicios: 40, niveis: 40, kg: 500, incremento: 50 } as const

export type Maquina = Aparelho & { exercicios: string[] }
export type DocMaquina = Omit<Maquina, 'id'> & { por?: string }

// O que a tela entrega (números já lidos; vazio = undefined).
export interface EntradaMaquina {
  nome: string
  local: string
  tipo: TipoMaquina
  fabricante?: string
  modelo?: string
  unidade: Unidade
  incremento?: number
  minimo?: number
  maximo?: number
  complementos?: number[]
  niveis?: number
  kgTopo?: number // kg estimado do nível 1 (placa do topo)
  kgPlaca?: number // kg de cada placa seguinte
  polia?: RazaoPolia
  porLado: boolean
  obs?: string
  exercicios: string[]
}

const chave = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const limpar = (s = '') => s.replace(/\s+/g, ' ').trim()
const slug = (s: string) => chave(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// "2,5" ou "2.5" → 2.5; vazio ou inválido → undefined.
export const lerNumero = (t: string): number | undefined => {
  const s = t.trim().replace(',', '.')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
// Plaquinhas digitadas: "0,625 0,625" ou "0,625; 1,25" → [0.625, 0.625]. Algo ilegível → null.
export const lerPlaquinhas = (t: string): number[] | null => {
  const partes = t.split(/[\s;/+]+/).filter(Boolean)
  const nums = partes.map(lerNumero)
  return nums.every((n): n is number => n != null) ? nums : null
}

export const idDaMaquina = (local: string, nome: string, ocupados: ReadonlySet<string>) => {
  const raiz = `m-${slug(`${local} ${nome}`).slice(0, 70).replace(/-+$/, '') || 'maquina'}`
  let id = raiz
  for (let n = 2; ocupados.has(id); n++) id = `${raiz}-${n}`
  return id
}

// Id do exercício para o vínculo: catálogo base ou cadastrado pelo coach. Texto livre: null (não vincula).
export const idDoExercicio = (nome: string) => resolverExercicio(nome)?.id ?? proprioPorNome(nome)?.id ?? null
export const nomeDoExercicio = (id: string) => exercicioPorId(id)?.nome ?? proprios().find((p) => p.id === id)?.nome ?? null

// Confere e monta o documento. `idAtual` = editando (o id não muda). Recusa a mesma máquina (nome + local) duas vezes.
export function validarMaquina(e: EntradaMaquina, existentes: readonly Maquina[], por: string, idAtual?: string) {
  const nome = limpar(e.nome)
  const local = limpar(e.local)
  if (nome.length < 2) return { erro: 'Escreva o nome da máquina (ex.: Cadeira Extensora).' } as const
  if (nome.length > LIMITES.nome) return { erro: `Use até ${LIMITES.nome} letras no nome.` } as const
  if (!local) return { erro: 'Escreva onde ela fica (academia ou condomínio).' } as const
  if (local.length > LIMITES.local) return { erro: `Use até ${LIMITES.local} letras no local.` } as const
  if (!TIPOS_MAQUINA.some((t) => t.id === e.tipo)) return { erro: 'Escolha o tipo da máquina.' } as const
  const outras = existentes.filter((m) => m.id !== idAtual)
  const dup = outras.find((m) => chave(m.nome) === chave(nome) && chave(m.local) === chave(local))
  if (dup) return { erro: `Já existe: ${dup.nome} em ${dup.local}.` } as const
  const exercicios = [...new Set(e.exercicios)]
  if (exercicios.length > LIMITES.exercicios) return { erro: `Até ${LIMITES.exercicios} exercícios por máquina.` } as const

  const dados: Record<string, unknown> = { nome, local, tipo: e.tipo, unidade: e.unidade, porLado: e.porLado, exercicios }
  const opcional = (k: string, v: string | undefined, max: number) => {
    const t = limpar(v).slice(0, max)
    if (t) dados[k] = t
  }
  opcional('fabricante', e.fabricante, LIMITES.rotulo)
  opcional('modelo', e.modelo, LIMITES.rotulo)
  opcional('obs', e.obs, LIMITES.obs)
  if (e.tipo === 'polia' || e.tipo === 'duasPolias') dados.polia = e.polia ?? '1:1'

  if (e.unidade === 'kg') {
    if (!(e.incremento! > 0)) return { erro: 'Diga de quanto em quanto sobe (ex.: 5 kg).' } as const
    if (e.incremento! > LIMITES.incremento) return { erro: `O degrau vai até ${LIMITES.incremento} kg.` } as const
    dados.incremento = e.incremento
    if (e.minimo != null) dados.minimo = e.minimo
    if (e.maximo != null) dados.maximo = e.maximo
    if (e.complementos?.length) dados.complementos = e.complementos
    if ([e.minimo, e.maximo].some((x) => x != null && x > LIMITES.kg)) return { erro: `Carga até ${LIMITES.kg} kg.` } as const
  } else {
    if (!Number.isInteger(e.niveis) || e.niveis! < 1) return { erro: 'Diga quantos níveis (pinos) a pilha tem.' } as const
    if (e.niveis! > LIMITES.niveis) return { erro: `Até ${LIMITES.niveis} níveis.` } as const
    dados.niveis = e.niveis
    // kg estimado: o topo sozinho já basta para o nível 1; com a placa, a pilha inteira.
    if (e.kgPlaca != null && e.kgTopo == null) return { erro: 'Diga também o kg do nível 1.' } as const
    if (e.kgTopo != null) {
      if (!(e.kgTopo > 0) || (e.kgPlaca != null && !(e.kgPlaca > 0))) return { erro: 'Os kg estimados devem ser maiores que 0.' } as const
      const kg = e.kgPlaca != null ? kgDaPilha(e.kgTopo, e.kgPlaca, e.niveis) : [e.kgTopo]
      if (kg[kg.length - 1] > LIMITES.kg) return { erro: `A pilha passaria de ${LIMITES.kg} kg.` } as const
      dados.kgNivel = kg
    }
  }
  // A mesma conferência do motor (problemasAparelho): o que passar aqui as contas sabem usar.
  const problemas = problemasAparelho({ id: idAtual ?? 'novo', ...dados })
  if (problemas.length) return { erro: `Confira: ${problemas.join(', ')}.` } as const
  const id = idAtual ?? idDaMaquina(local, nome, new Set(existentes.map((m) => m.id)))
  return { id, dados: { ...dados, por: limpar(por).slice(0, 80) || 'Coach' } as DocMaquina } as const
}

// Documento lido → máquina. Campos fora do modelo ficam de fora.
export const deDoc = (d: DocMaquina & { id: string }): Maquina => {
  const { por: _por, em: _em, ...resto } = d as DocMaquina & { id: string; em?: unknown }
  return { ...resto, exercicios: Array.isArray(d.exercicios) ? d.exercicios : [] } as Maquina
}

// De volta para o formulário (editar). Pilha com placas desiguais (não veio desta tela): topo + 1ª placa, com aviso.
export function paraEntrada(m: Maquina): EntradaMaquina & { pilhaIrregular: boolean } {
  const base = {
    nome: m.nome, local: m.local, tipo: m.tipo as TipoMaquina, fabricante: m.fabricante, modelo: m.modelo, unidade: m.unidade,
    polia: m.polia, porLado: !!m.porLado, obs: m.obs, exercicios: m.exercicios,
  }
  if (m.unidade === 'kg') return { ...base, incremento: m.incremento, minimo: m.minimo, maximo: m.maximo, complementos: m.complementos, pilhaIrregular: false }
  const kg = m.kgNivel ?? []
  const placa = kg.length > 1 && kg[0] != null && kg[1] != null ? Math.round((kg[1] - kg[0]) * 1000) / 1000 : undefined
  const regular = placa == null ? kg.length <= 1 : kgDaPilha(kg[0]!, placa, m.niveis).every((k, i) => i >= kg.length || kg[i] === k)
  return { ...base, niveis: m.niveis, kgTopo: kg[0] ?? undefined, kgPlaca: placa, pilhaIrregular: !regular || kg.length > m.niveis }
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

// Uma linha para o card: como a carga sobe nesta máquina.
export function resumoEscala(m: Aparelho): string {
  const partes: string[] = []
  if (m.unidade === 'kg') {
    partes.push(`${fmt(m.incremento)} em ${fmt(m.incremento)} kg`)
    const min = m.minimo ?? m.incremento
    partes.push(m.maximo != null ? `${fmt(min)} a ${fmt(m.maximo)} kg` : `a partir de ${fmt(min)} kg`)
    if (m.complementos?.length) partes.push(`plaquinhas ${m.complementos.map(fmt).join(' + ')} kg`)
  } else {
    partes.push(`${m.niveis} níveis`)
    const kg = m.kgNivel ?? []
    if (kg[0] != null) partes.push(kg.length > 1 && kg[1] != null ? `nível 1 ≈ ${fmt(kg[0])} kg, +${fmt(kg[1] - kg[0])} por nível` : `nível 1 ≈ ${fmt(kg[0])} kg`)
    else partes.push('kg não informado')
  }
  if (m.polia === '2:1') partes.push('polia 2:1')
  if (m.porLado) partes.push('por lado')
  return partes.join(' · ')
}

// Máquinas vinculadas a um exercício (pelo nome que está no treino: antigo, novo ou cadastrado).
export function maquinasDoExercicio(lista: readonly Maquina[], nomeExercicio: string): Maquina[] {
  const id = idDoExercicio(nomeExercicio)
  return id ? lista.filter((m) => m.exercicios.includes(id)) : []
}

// Índice exercício (id) → máquinas, para listas longas (catálogo).
export function porExercicio(lista: readonly Maquina[]): Map<string, Maquina[]> {
  const m = new Map<string, Maquina[]>()
  for (const x of lista) for (const id of x.exercicios) m.set(id, [...(m.get(id) ?? []), x])
  return m
}

// Locais já usados (para sugerir ao digitar), do mais usado para o menos.
export function locais(lista: readonly Maquina[]): string[] {
  const n = new Map<string, number>()
  for (const m of lista) n.set(m.local, (n.get(m.local) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).map(([l]) => l)
}

// ---- Máquina no treino (#261) ----

// Cópia que vai para o exercício do treino: a escala daquele momento, sem observação nem lista de exercícios.
// O aluno lê só esta cópia (não lê `maquinas`); editar a máquina depois não muda o que já está no treino.
export function paraSlot(m: Maquina): Aparelho {
  const { exercicios: _e, obs: _o, ...escala } = m
  return escala as Aparelho
}

// A cópia do exercício ainda é igual à máquina do catálogo? (false = a escala mudou depois; escolher de novo atualiza.)
export const mesmaEscala = (copia: Aparelho, atual: Maquina) => JSON.stringify(ordenar(copia)) === JSON.stringify(ordenar(paraSlot(atual)))
const ordenar = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)))

// Máquina usada num treino já registrado, só pela cópia gravada no registro ao iniciar (prescricaoRegistrada).
// - { maquina }: a escala daquele dia; null = treino registrado sem máquina nesse exercício.
// - 'legado': sem cópia gravada (treino antigo, de antes desta etapa, ou cópia reconstruída): NÃO se atribui
//   máquina por inferência (nem pela máquina atual do plano).
// Ajuste presencial do dia (sessoes[chave], gravado com prescricoesRegistradas[chave] = null): é a escolha explícita
// do coach para aquele treino e vale como fonte confiável, também se a máquina foi trocada depois do início.
export function maquinaUsada(meso: Pick<Meso, 'prescricoesRegistradas' | 'sessoes'>, semana: number, treino: number, slotId: string): { maquina: Aparelho | null } | 'legado' {
  const slots = slotsConfiaveis(meso, semana, treino)
  const s = slots?.find((x) => x.slotId === slotId)
  return s ? { maquina: s.maquina ?? null } : 'legado'
}

function slotsConfiaveis(meso: Pick<Meso, 'prescricoesRegistradas' | 'sessoes'>, semana: number, treino: number) {
  const chave = `${semana}-${treino}`
  const p = meso.prescricoesRegistradas?.[chave]
  if (p === null && meso.sessoes?.[chave]) return meso.sessoes[chave].exercicios
  return p && !p.referenciaHistorica ? p.sessao.exercicios.map((e) => e.slot) : null
}

// Linha curta para o aluno e o coach: "Cadeira Extensora · Academia Centro". Ainda não pede para anotar o nível:
// o treino, as métricas e a carga anterior só entendem kg; a anotação em nível vem com a carga por máquina (#262).
export const textoMaquina = (m: Aparelho) => `${m.nome} · ${m.local}`

// Treino já registrado (com carga, reps, início ou feito) sem cópia confiável: a máquina daquele dia é desconhecida.
// A tela não mostra a máquina do plano atual nele (seria atribuir por inferência). Sem registro, vale o plano.
export function maquinaDesconhecida(meso: Pick<Meso, 'prescricoesRegistradas' | 'sessoes'>, semana: number, treino: number, registro?: { cargas?: object; reps?: object; realizado?: boolean; inicioEm?: unknown } | null): boolean {
  const registrada = !!registro && (!!registro.realizado || registro.inicioEm != null || Object.keys(registro.cargas ?? {}).length > 0 || Object.keys(registro.reps ?? {}).length > 0)
  return registrada && !slotsConfiaveis(meso, semana, treino)
}
