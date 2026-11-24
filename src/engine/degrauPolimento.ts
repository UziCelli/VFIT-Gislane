import { proximoValor, type Aparelho } from './aparelho'
import { passoDoAparelho, passoPorLado } from './passo'

export function cargaPolimento(kg: number, nome: string, degraus: number, dois: boolean, aparelho?: Aparelho | null) {
  if (aparelho?.unidade === 'nivel' || !Number.isFinite(kg) || kg <= 0) return kg
  const ap = aparelho && (!dois || aparelho.porLado) ? aparelho : null
  const passo = dois ? passoPorLado(nome) : passoDoAparelho(nome)
  let v = kg
  for (let i = 0; i < degraus; i++) {
    const p = typeof passo === 'function' ? passo(v - 1e-6) : passo
    const menor = ap ? proximoValor(ap, v, -1) : Math.round((Math.ceil((v - 1e-8) / p) - 1) * p * 1000) / 1000
    if (menor != null && menor > 0 && menor < v) v = menor
  }
  return v
}
