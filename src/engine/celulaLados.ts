const arred = (x: number) => Math.round(x * 100) / 100

export interface CelulaLados {
  esq: number | null
  dir: number | null
  antigo: number | null // formato antigo: o número inteiro anotado (sem o corpo); esq/dir ficam null
}

// `total` = carga da célula (já normalizada); `esq` = lados.<slot>.sN; `pc` = peso do corpo do registro.
export function lerCelula(total: number | null | undefined, esq: number | null | undefined, pc = 0): CelulaLados {
  if (total == null) return { esq: null, dir: null, antigo: null }
  // esq > total - pc: versão antiga do app editou só o total; a divisão não vale mais, vira antiga (o total segue certo).
  if (esq == null || esq > arred(total - pc)) return { esq: null, dir: null, antigo: Math.max(0, arred(total - pc)) }
  return { esq, dir: Math.max(0, arred(total - pc - esq)), antigo: null }
}
