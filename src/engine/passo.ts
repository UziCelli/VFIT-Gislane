// Degrau real de carga de cada tipo de aparelho: a sugestão estimada cai num peso que existe na academia, não em 0,5 kg.
// Usa classificarEquipamento (engine/sugestao.ts). SUPOSIÇÕES (academia comum no Brasil), a confirmar:
// - halter: de 1 em 1 kg até 10 kg; acima, de 2 em 2 kg.
// - barra: anilha de 1 kg de cada lado = 2 kg.
// - máquina (placas, articuladas, leg press): 5 kg. Articulada/leg press com anilha pode ser menor (2 kg) ou maior (10 kg).
// - polia e duas polias: placa de 5 kg (por lado, em duas polias).
// - peso do corpo / não reconhecido: 0,5 kg (como antes, nada muda).
// Aparelho sem etiqueta de peso (só níveis 1, 2, 3...) fica para o catálogo de aparelhos.
import { PASSO_KG, type Passo } from './rm'
import { classificarEquipamento, type Equipamento } from './sugestao'

const halter = (kg: number) => (kg <= 10 ? 1 : 2)

export const PASSOS: Record<Equipamento, Passo> = {
  halter,
  barra: 2,
  maquina: 5,
  polia: 5,
  duasPolias: 5,
  pesoCorporal: PASSO_KG,
}

export const passoDoAparelho = (nome: string): Passo => PASSOS[classificarEquipamento(nome)]
