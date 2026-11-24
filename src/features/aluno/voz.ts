import { createContext, useContext } from 'react'

// Quem está lendo a tela do treino. No app do aluno, a tela fala com ele ("você"). No presencial, o coach vê
// a MESMA tela, com as mesmas funções e botões; só os textos falam do aluno em 3ª pessoa, pelo primeiro nome
// (sem supor gênero). Regra do Victor (24/11/2026): nenhuma função do aluno some no presencial.
// Recurso novo do aluno: leia o texto de `textosVoz(useVoz())` (ou acrescente aqui a versão do coach) e não
// esconda com `coach`. O teste `voz.test.ts` barra um `!coach` novo no Treino.
export type Voz = { coach: boolean; nome: string }

export const VozTreino = createContext<Voz>({ coach: false, nome: '' })
export const useVoz = () => useContext(VozTreino)

export const primeiroNome = (nome?: string) => nome?.trim().split(/\s+/)[0] ?? ''

export function textosVoz({ coach, nome }: Voz) {
  const n = primeiroNome(nome) || 'o aluno' // no meio da frase
  const N = n[0].toUpperCase() + n.slice(1) // no começo da frase
  return {
    // Pergunta de repetições que sobraram (RIR)
    rirPergunta: coach ? `${N} ainda faria quantas?` : 'Ainda faria quantas?',
    rirRotulo: coach ? `Quantas repetições ${n} ainda faria?` : 'Quantas repetições ainda faria?',
    // Relato de dor
    dorBotao: coach ? `${N} sentiu dor` : 'Senti dor',
    dorOrientacao: (nivel: 'seguir' | 'reduzir' | 'parar', texto: string) => (coach ? {
      parar: `${N} deve parar esse exercício hoje.`,
      reduzir: `Reduza a carga, a amplitude ou a velocidade para ${n}.`,
      seguir: `${N} pode seguir com atenção. Se aumentar, reduza ou pare.`,
    }[nivel] : texto),
    adaptado: coach ? `O treino de ${n} foi adaptado para progredir dentro do tempo disponível.` : 'Seu coach adaptou seu treino para você progredir dentro do seu tempo.',
    dorQuemVe: coach ? `O relato fica no histórico de dor de ${n}.` : 'Seu coach vai ver o relato no app.',
    dorErro: coach ? 'Não conseguimos enviar o relato. Confira a internet e registre de novo.' : 'Não conseguimos enviar o relato. Fale diretamente com seu coach.',
    // Físio
    fisioPausado: coach ? `Físio pausado — ${n} relatou um sinal de alerta` : 'Físio pausado — fale com seu coach',
    recado: coach ? 'Seu recado:' : 'Seu coach:',
    sinalBotao: coach ? `${N} está com um desses sinais de alerta` : 'Estou com um desses sinais de alerta',
    sinalParar: coach
      ? `Interrompa este exercício e oriente ${n} a procurar médico ou fisioterapeuta. O protocolo desta orientação foi ocultado.`
      : 'Pare este exercício e procure médico ou fisioterapeuta. Não espere uma resposta do coach para buscar atendimento. O protocolo desta orientação foi ocultado.',
    sinalSincronizando: coach ? 'Aguardando sincronização do relato. Confira a internet.' : 'Aguardando sincronização do relato. Se estiver sem internet, fale diretamente com seu coach.',
    sinalRegistrado: coach ? 'Relato registrado.' : 'Relato registrado para o coach.',
    sinalErro: coach ? 'Não conseguimos confirmar o envio do relato. Confira a internet.' : 'Não conseguimos confirmar o envio do relato. Fale diretamente com seu coach.',
    // Aviso da aba Treino (Hoje)
    repsAbaixo: (series: number, exemplo: string) => `nos últimos 7 dias ${coach ? `${n} fez` : 'você fez'} menos reps que o previsto em ${series} séries (ex.: ${exemplo}). Pode ser descanso curto, sono ou alimentação. No próximo treino, ${coach ? `diminua um pouco o peso para ${n} completar` : 'diminua um pouco o peso para completar'} as reps.`,
    // Peso do corpo
    pesoPergunta: coach ? `Qual é o peso de ${n} (kg)?` : 'Qual é o seu peso (kg)?',
    // Anamnese (o coach nunca fica travado: só fica sabendo)
    anamnesePendente: `${N} ainda não respondeu a anamnese.`,
    // Check-in do fim do treino
    checkinTitulo: coach ? `Como ${n} está?` : 'Como você está?',
    checkinSub: coach ? `Pergunte a ${n} e marque as respostas.` : 'Vai só para o seu coach.',
    checkinRecebido: coach ? 'Check-in registrado.' : 'Recebido pelo seu coach.',
    checkinJa: coach ? `${N} já respondeu este treino.` : 'Você já respondeu este treino.',
    checkinOffline: coach ? 'Salvo no aparelho; envia quando houver internet.' : 'Salvo no aparelho; vai para o seu coach quando houver internet.',
    checkinPergunta: (id: string, rotulo: string) => (coach ? ({
      sono: `Como ${n} dormiu esta noite?`,
      estresse: `Como está o estresse de ${n}?`,
      alimentacao: `Como ${n} se alimentou hoje?`,
    } as Record<string, string>)[id] ?? rotulo : rotulo),
  }
}

export const useTextosVoz = () => textosVoz(useVoz())
