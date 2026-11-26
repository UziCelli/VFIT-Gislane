// Anatomia do catálogo: articulações e músculos de cada exercício (base do sistema Físio, docs/plano-fisio.md).
// Dados em src/data/anatomia.json, por id do exercício. Fica fora do exercicios.json porque
// tools/extrair_planilha.py regrava aquele arquivo inteiro. Funções puras.
import anatomia from '../data/anatomia.json'
import { resolverExercicio } from '../data/catalogo'

// Mesmos ids da anamnese (pergunta "dores"): a dor do treino cruza com a da ficha. O teste compara os dois.
export const ARTICULACOES = ['ombro', 'cotovelo', 'punho', 'cervical', 'lombar', 'quadril', 'joelho', 'tornozelo'] as const
export type ArticulacaoId = (typeof ARTICULACOES)[number]

export const MUSCULOS = {
  quadriceps: 'Quadríceps', gluteos: 'Glúteos', isquiotibiais: 'Posteriores de coxa', adutores: 'Adutores',
  abdutores: 'Abdutores (glúteo médio)', panturrilha: 'Panturrilha', peitoral: 'Peitoral', dorsal: 'Dorsal',
  trapezio: 'Trapézio e romboides', 'deltoide-anterior': 'Deltoide anterior', 'deltoide-lateral': 'Deltoide lateral',
  'deltoide-posterior': 'Deltoide posterior', manguito: 'Manguito rotador', biceps: 'Bíceps', triceps: 'Tríceps',
  antebraco: 'Antebraço', abdomen: 'Abdômen', obliquos: 'Oblíquos', lombar: 'Lombar (eretores)',
} as const
export type MusculoId = keyof typeof MUSCULOS

// `articulacoes` em ordem de importância (a 1ª é a mais carregada no exercício).
export type Anatomia = { articulacoes: ArticulacaoId[]; principais: MusculoId[]; secundarios: MusculoId[] }

const DADOS = anatomia as Record<string, Anatomia>

// Nome atual, novo ou apelido do catálogo. Fora do catálogo (texto livre): null. Nunca adivinha.
export const anatomiaDo = (nome: string): Anatomia | null => {
  const e = resolverExercicio(nome)
  return e ? (DADOS[e.id] ?? null) : null
}

// Opções do "Senti dor": as do exercício; fora do catálogo, todas.
export const articulacoesDo = (nome: string): readonly ArticulacaoId[] => anatomiaDo(nome)?.articulacoes ?? ARTICULACOES
