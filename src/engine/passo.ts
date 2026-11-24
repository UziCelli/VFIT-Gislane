// Degrau real de carga de cada tipo de aparelho: a sugestão estimada cai num peso que existe na academia, não em 0,5 kg.
// Usa classificarEquipamento (engine/sugestao.ts). SUPOSIÇÕES (academia comum no Brasil), a confirmar:
// - halter: de 1 em 1 kg até 10 kg; acima, de 2 em 2 kg.
// - barra e aparelho de anilha (leg press, smith, hack, articulada, pêndulo): anilhas de 1,25, 2,5, 5, 10... A menor
//   (1,25) dos dois lados = 2,5 kg. Confirmado pelo Celli.
// - máquina seletora (MTS: cadeira, flexora, extensora, peck deck...) e polia móvel: 2,5 kg (confirmado pelo Celli).
//   Exceções de fabricante (ex.: polia Life Fitness, que sobe de 0,625 em 0,625) entram pelo catálogo de aparelhos
//   (engine/aparelho.ts, campo `incremento`), não por aqui.
// Sempre para o valor mais próximo (confirmado).
// - peso do corpo / não reconhecido: 0,5 kg (como antes, nada muda).
// Aparelho sem etiqueta de peso (só níveis 1, 2, 3...) fica para o catálogo de aparelhos.
import { PASSO_KG, type Passo } from './rm'
import { classificarEquipamento, norm, type Equipamento } from './sugestao'

const halter = (kg: number) => (kg <= 10 ? 1 : 2)

export const PASSOS: Record<Equipamento, Passo> = {
  halter,
  barra: 2.5,
  maquina: 2.5,
  polia: 2.5,
  duasPolias: 2.5,
  pesoCorporal: PASSO_KG,
}

export const PASSO_ANILHA = 2.5
const DE_ANILHA = ['leg press', 'smith', 'hack', 'articulad', 'pendulo']

export function passoDoAparelho(nome: string): Passo {
  const equip = classificarEquipamento(nome)
  if (equip === 'maquina' && DE_ANILHA.some((p) => norm(nome).includes(p))) return PASSO_ANILHA
  return PASSOS[equip]
}
