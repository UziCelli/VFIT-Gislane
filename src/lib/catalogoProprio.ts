// Exercícios cadastrados pelo coach (épico #255, etapa 4 #259). Funções puras.
// Firestore: exerciciosProprios/{id} = { base, grupo, equipamento, sufixo, lateralidade, modo, carga, por, em }.
// Fica fora do catálogo base (src/data): o extrator da planilha nunca o regrava e cada marca tem o próprio Firebase.
// Identidade = o nome (como texto livre): o exercício não é renomeado depois de salvo, então histórico e vídeos
// continuam ligados a ele. A busca do coach e as pílulas enxergam a lista carregada em definirProprios().
import catalogo from '../data/exercicios.json'
import { EQUIPAMENTOS, nomeGerado, resolverExercicio, type ConvencaoCarga, type Equipamento, type Lateralidade } from '../data/catalogo'

export const GRUPOS: readonly string[] = catalogo.map((g) => g.grupo)
export const MAX_BASE = 60
// Isométrico fica de fora por ora: o cronômetro do treino só reconhece os isométricos do catálogo base.
export type ModoProprio = 'excentrico'

export interface DadosProprio {
  base: string
  grupo: string
  equipamento: Equipamento
  sufixo: boolean // false: nome próprio de máquina (o equipamento aparece só na pílula)
  lateralidade: Lateralidade
  modo: ModoProprio[]
  carga: ConvencaoCarga
}
export interface ExercicioProprio extends DadosProprio {
  id: string
  nome: string
}
export type DocProprio = DadosProprio & { por?: string }

const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const limpar = (s: string) => s.replace(/\s+/g, ' ').trim()

// Carga padrão pelo equipamento: o coach pode trocar no cadastro.
export const cargaPadrao = (e: Equipamento): ConvencaoCarga => (e === 'peso_do_corpo' ? 'corporal' : e === 'halteres' || e === 'kettlebells' ? 'por_lado' : 'total')

export const nomeDoProprio = (d: Pick<DadosProprio, 'base' | 'sufixo' | 'equipamento'>) => nomeGerado({ ...d, base: limpar(d.base) })

export const idDoProprio = (nome: string) =>
  `p-${chave(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 76) || 'exercicio'}`

// Confere e monta o documento. Recusa duplicata: mesmo nome (sem acento/caixa/espaço) no catálogo base, em
// qualquer nome antigo/apelido dele, ou entre os já cadastrados.
export function validarProprio(d: DadosProprio, existentes: readonly ExercicioProprio[], por: string) {
  const base = limpar(d.base)
  if (base.length < 3) return { erro: 'Escreva o movimento (ex.: Supino Inclinado).' } as const
  if (base.length > MAX_BASE) return { erro: `Use até ${MAX_BASE} letras no movimento.` } as const
  if (!GRUPOS.includes(d.grupo)) return { erro: 'Escolha o grupo muscular.' } as const
  if (!(d.equipamento in EQUIPAMENTOS)) return { erro: 'Escolha o equipamento.' } as const
  const nome = nomeDoProprio({ ...d, base })
  const igual = resolverExercicio(nome)
  if (igual) return { erro: `Já existe no catálogo: ${igual.nome}.` } as const
  const k = chave(nome)
  const dup = existentes.find((e) => chave(e.nome) === k)
  if (dup) return { erro: `Você já cadastrou: ${dup.nome}.` } as const
  const dados: DocProprio = {
    base, grupo: d.grupo, equipamento: d.equipamento, sufixo: d.sufixo, lateralidade: d.lateralidade,
    modo: d.modo.filter((m) => m === 'excentrico'), carga: d.carga, por: limpar(por).slice(0, 80) || 'Coach',
  }
  return { id: idDoProprio(nome), nome, dados } as const
}

export const deDoc = (d: DocProprio & { id: string }): ExercicioProprio => ({
  id: d.id, base: d.base, grupo: d.grupo, equipamento: d.equipamento, sufixo: d.sufixo, lateralidade: d.lateralidade,
  modo: d.modo ?? [], carga: d.carga, nome: nomeDoProprio(d),
})

// ---- Lista carregada (coach) ----
let PROPRIOS: readonly ExercicioProprio[] = []
let POR_NOME = new Map<string, ExercicioProprio>()
let versao = 0

export function definirProprios(lista: readonly ExercicioProprio[]) {
  PROPRIOS = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  POR_NOME = new Map(PROPRIOS.map((e) => [chave(e.nome), e]))
  versao++
}
export const proprios = () => PROPRIOS
export const versaoProprios = () => versao
export const proprioPorNome = (nome: string) => POR_NOME.get(chave(nome)) ?? null
