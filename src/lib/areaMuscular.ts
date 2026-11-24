// Músculo estimado por perímetro e dobra (antropometria). Funções puras, sem gravar nada: saem na hora do relatório.
// As dobras são medidas de um lado só e valem para os dois (a gordura subcutânea costuma ser simétrica; nos braços,
// a mão dominante pode dar diferença). Com lipedema na região, não há estimativa: a dobra não representa o segmento.
// Fontes e limites: aba Referências (GuiaReferencias.tsx) e docs/evidencias-avaliacao.md.
import type { Sexo } from './avaliacao'

const r1 = (x: number) => Math.round(x * 10) / 10

// Perímetro corrigido (cm): o perímetro sem o anel de gordura da dobra. Dobra em mm (π × dobra em cm).
export const perimetroCorrigido = (perimetroCm: number, dobraMm: number) => perimetroCm - Math.PI * (dobraMm / 10)

// Área de um círculo a partir do perímetro corrigido (cm²). Base de Moritani & deVries e de Heymsfield.
const areaCirculo = (pc: number) => (pc * pc) / (4 * Math.PI)

// Área muscular do braço sem o osso (Heymsfield et al., 1982): desconta 10 cm² (homens) ou 6,5 cm² (mulheres).
// Dobra do tríceps. Erro médio individual de 7 a 8% contra tomografia.
export function areaMuscularBraco(perimetroCm: number, tricepsMm: number, sexo: Sexo): number | null {
  const pc = perimetroCorrigido(perimetroCm, tricepsMm)
  if (pc <= 0) return null
  const a = areaCirculo(pc) - (sexo === 'M' ? 10 : 6.5)
  return a > 0 ? r1(a) : null
}

// Área muscular da coxa, com osso (modelo de círculos concêntricos; Moritani & deVries; validado em MRI e pQCT).
// Dobra da coxa (anterior). Superestima o valor absoluto, mas acompanha a mudança com o treino (DeFreitas et al., 2010).
export function areaMuscularCoxa(perimetroCm: number, coxaMm: number): number | null {
  const pc = perimetroCorrigido(perimetroCm, coxaMm)
  return pc > 0 ? r1(areaCirculo(pc)) : null
}

// Massa muscular esquelética total, kg (Lee et al., 2000, modelo 1; MRI; R² 0,91; erro padrão 2,2 kg).
// Só para IMC abaixo de 30, que é onde foi validada. Sem o ajuste de etnia (o app não pergunta): fica o de brancos e hispânicos.
export function massaMuscularLee(p: {
  alturaCm: number; pesoKg: number; sexo: Sexo; idade: number
  braco: number; coxa: number; panturrilha: number // perímetros, cm
  triceps: number; coxaDobra: number; panturrilhaDobra: number // dobras, mm
}): number | null {
  const altM = p.alturaCm / 100
  if (p.pesoKg / (altM * altM) >= 30) return null
  const cag = perimetroCorrigido(p.braco, p.triceps)
  const ctg = perimetroCorrigido(p.coxa, p.coxaDobra)
  const ccg = perimetroCorrigido(p.panturrilha, p.panturrilhaDobra)
  if (cag <= 0 || ctg <= 0 || ccg <= 0) return null
  const sm = altM * (0.00744 * cag * cag + 0.00088 * ctg * ctg + 0.00441 * ccg * ccg) + 2.4 * (p.sexo === 'M' ? 1 : 0) - 0.048 * p.idade + 7.8
  return sm > 0 && sm < p.pesoKg ? r1(sm) : null
}
