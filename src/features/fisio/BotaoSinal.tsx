import { useRef, useState } from 'react'
import { Aviso, Botao } from '../../ui'
import { relatarSinalFisio } from './acoesFisio'
import { useTextosVoz } from '../aluno/voz'

// "Estou com um desses sinais de alerta": grava o sinal (campo a campo), mostra o aviso de parada na hora e o estado
// do envio (pendente offline). Devolve `interrompida` ao pai para ele ocultar protocolo e recado.
export default function BotaoSinal({ id, sinalRelatado, pendente, children }: { id: string; sinalRelatado: boolean; pendente: boolean; children: (interrompida: boolean) => React.ReactNode }) {
  const t = useTextosVoz() // presencial: o coach relata o sinal pelo aluno
  const [relatando, setRelatando] = useState(false)
  const [erro, setErro] = useState('')
  const trava = useRef(false)
  const interrompida = sinalRelatado || relatando || !!erro
  async function relatar() {
    if (trava.current) return
    trava.current = true
    // A orientação de parada independe de internet ou confirmação do servidor.
    setRelatando(true)
    setErro('')
    try { await relatarSinalFisio(id); setRelatando(false) }
    catch { setErro(t.sinalErro); setRelatando(false) }
    finally { trava.current = false }
  }
  return <>
    {interrompida && <div className="mb-3" role="alert"><Aviso>{t.sinalParar}</Aviso></div>}
    {children(interrompida)}
    {!sinalRelatado && <Botao className="mt-3 w-full" tipo="perigo" disabled={relatando} onClick={relatar}>{relatando ? 'Relato aguardando confirmação…' : erro ? 'Tentar enviar relato novamente' : t.sinalBotao}</Botao>}
    {(relatando || (sinalRelatado && pendente)) && <p role="status" className="mt-2 text-sm text-amber-200">{t.sinalSincronizando}</p>}
    {sinalRelatado && !pendente && !relatando && <p role="status" className="mt-2 text-sm">{t.sinalRegistrado}</p>}
    {erro && <p role="status" className="mt-2 text-sm text-amber-200">{erro}</p>}
  </>
}
