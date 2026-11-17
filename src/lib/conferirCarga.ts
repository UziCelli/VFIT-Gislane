// "Confere?": pede confirmação de 1 toque quando a carga digitada fica bem fora da referência (o número cinza ou a última
// carga), para erro de digitação (600 em vez de 60) não entrar no histórico. Função pura; a tela só pergunta na 1ª digitação
// da célula (corrigir um número já gravado nunca pergunta).
export const RAZAO_ALTA = 1.5
export const RAZAO_BAIXA = 0.67
export const DIFERENCA_MIN_KG = 5 // cargas leves variam muito em proporção (2 → 3 kg): só pergunta se a diferença passa disto

export function cargaSuspeita(kg: number, referencia: number | null | undefined): boolean {
  if (!(kg > 0) || referencia == null || !(referencia > 0)) return false
  const razao = kg / referencia
  return (razao >= RAZAO_ALTA || razao <= RAZAO_BAIXA) && Math.abs(kg - referencia) >= DIFERENCA_MIN_KG
}
