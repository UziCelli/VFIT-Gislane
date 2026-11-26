// Carga por lado (2 halteres / máquina articulada). Funções puras. Plano: docs/plano-lados-isometria.md.
// Convenção: cargas.<slot>.sN = TOTAL (esq + dir + pc); lados.<slot>.sN = kg do lado ESQUERDO.
// Célula com `lados` = formato novo. Célula sem `lados` num slot de 2 lados = antiga (só lida, nunca reescrita).
import { resolverExercicio } from '../data/catalogo'
import type { Slot } from '../engine'
import type { CelulaLados } from '../engine/celulaLados'

// Padrão do catálogo (convenção de carga em src/data/atributos.json, pelo nome atual, novo ou apelido);
// exercício fora do catálogo = comum.
export const doisLadosPadrao = (nome: string) => resolverExercicio(nome)?.carga === 'por_lado'

// O ajuste do meso (slot.doisLados) vence o catálogo.
export const doisLados = (slot: Pick<Slot, 'nome' | 'doisLados'>) => slot.doisLados ?? doisLadosPadrao(slot.nome)

const arred = (x: number) => Math.round(x * 100) / 100

export const totalLados = (esq: number, dir: number, pc = 0) => arred(esq + dir + pc)

export { lerCelula, type CelulaLados } from '../engine/celulaLados'

export const ladosDiferentes = (cels: CelulaLados[]) => cels.some((c) => c.esq != null && c.esq !== c.dir)
