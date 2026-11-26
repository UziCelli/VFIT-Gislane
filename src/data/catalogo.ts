// Catálogo de exercícios com atributos (épico #255, etapa 2 #257). Funções puras.
// Atributos por id em src/data/atributos.json: fora do exercicios.json porque tools/extrair_planilha.py
// regrava aquele arquivo inteiro. O nome completo é GERADO dos atributos (base + rótulo do equipamento);
// nomes antigos ficam como apelidos e continuam resolvendo para o mesmo id.
// Fica em src/data (como aparelhos.ts) para servir ao engine e ao lib sem inverter as camadas.
import atributos from './atributos.json'
import catalogo from './exercicios.json'

export const EQUIPAMENTOS = {
  halter: 'Halter', halteres: 'Halteres', barra: 'Barra', barra_w: 'Barra W', barra_hexagonal: 'Barra Hexagonal',
  smith: 'Smith', smith_dual: 'Smith Dual', polia: 'Polia', duas_polias: 'Duas Polias',
  maquina_seletora: 'Máquina Seletora', maquina_articulada: 'Articulada', elastico: 'Elástico', anilha: 'Anilha',
  kettlebell: 'Kettlebell', kettlebells: 'Kettlebells', medicine_ball: 'Medicine Ball', caneleira: 'Caneleira',
  peso_do_corpo: 'Peso do Corpo', suspensao: 'Suspensão', bola_suica: 'Bola Suíça', landmine: 'Landmine',
  outro: 'Outro',
} as const
export type Equipamento = keyof typeof EQUIPAMENTOS

// Como a carga entra: pinos (seletora), anilhas (articulada/smith), livre (halter, barra), corporal, elástico.
export type Mecanismo = 'pinos' | 'anilhas' | 'livre' | 'corporal' | 'elastico' | 'nenhum'
export type Lateralidade = 'bilateral' | 'unilateral' | 'alternado'
export type Modo = 'dinamico' | 'isometrico' | 'excentrico'
export type Unidade = 'reps' | 'tempo'
// total: o número anotado é a carga toda · por_lado: kg de cada lado · corporal: peso do corpo (+ extra).
export type ConvencaoCarga = 'total' | 'por_lado' | 'corporal'

export interface Atributos {
  base: string // nome sem o equipamento, ex.: 'Supino Reto'
  sufixo: boolean // false: máquina com nome próprio (Leg Press 45); o equipamento aparece só na pílula
  equipamento: Equipamento | null // null = a confirmar com o Celli; nunca adivinhado
  mecanismo: Mecanismo | null
  lateralidade: Lateralidade
  modo: Modo[]
  unidade: Unidade
  carga: ConvencaoCarga
  movimento: string | null
  apelidos: string[]
  aConfirmar?: string
  oculto?: string // excluído pelo Celli: sai da busca e do catálogo, mas continua resolvendo (histórico)
}

export interface Exercicio extends Atributos {
  id: string
  grupo: string
  nome: string // gerado
  nomeCatalogo: string // nome atual no exercicios.json (o que os treinos já gravados usam)
}

export const nomeGerado = (a: Pick<Atributos, 'base' | 'sufixo' | 'equipamento'>) =>
  a.sufixo && a.equipamento ? `${a.base} ${EQUIPAMENTOS[a.equipamento]}` : a.base

const DADOS = atributos as Record<string, Atributos>

export const EXERCICIOS: readonly Exercicio[] = catalogo.flatMap((g) =>
  g.exercicios.map((e) => {
    const a = DADOS[e.id]
    return { ...a, id: e.id, grupo: g.grupo, nome: nomeGerado(a), nomeCatalogo: e.nome }
  }),
)

const POR_ID = new Map(EXERCICIOS.map((e) => [e.id, e]))
const chave = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
// Todo nome conhecido (atual, gerado e apelidos) aponta para um único id. O teste garante que não há colisão.
const POR_NOME = new Map(EXERCICIOS.flatMap((e) => [e.nomeCatalogo, e.nome, ...e.apelidos].map((n) => [chave(n), e] as const)))

// O que o coach escolhe hoje (busca, catálogo, IA). Os ocultos continuam em EXERCICIOS para o histórico.
export const EXERCICIOS_ATIVOS: readonly Exercicio[] = EXERCICIOS.filter((e) => !e.oculto)

export const exercicioPorId = (id: string): Exercicio | null => POR_ID.get(id) ?? null

// Nome fora do catálogo (texto livre): null. Nunca adivinha por semelhança.
export const resolverExercicio = (nome: string): Exercicio | null => POR_NOME.get(chave(nome)) ?? null

// Todos os nomes que resolvem para cada exercício (para teste e para a busca por nome antigo).
export const nomesConhecidos = (e: Exercicio) => [...new Set([e.nomeCatalogo, e.nome, ...e.apelidos])]

// Nome para agrupar e mostrar histórico: o nome gerado do catálogo (treinos antigos com o nome antigo juntam
// com os novos). Fora do catálogo: o próprio texto.
export const nomeAtualizado = (nome: string) => resolverExercicio(nome)?.nome ?? nome.trim()

// Identidade para comparar histórico (carga anterior, RM pessoal, repetidos): o mesmo exercício com o nome antigo
// ou o novo dá a mesma chave. Fora do catálogo (texto livre): o próprio texto normalizado, como antes.
export const chaveExercicio = (nome: string) => {
  const e = resolverExercicio(nome)
  return e ? `#${e.id}` : chave(nome)
}
