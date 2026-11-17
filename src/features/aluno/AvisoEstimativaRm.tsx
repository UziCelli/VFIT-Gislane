import { useState } from 'react'
import { salvarEstimativaRm } from '../../lib/acoes'
import { Aviso, Botao, Modal } from '../../ui'

// Pop-up de uma vez só no treino (mini onboarding): explica a carga sugerida pelas repetições e pede a escolha.
// Qualquer saída grava a escolha (Ligar = true; Agora não, fundo ou Esc = false), então não volta. Vale para aluno e coach.
export default function AvisoEstimativaRm({ uid, onde }: { uid: string; onde: string }) {
  const [erro, setErro] = useState(false)
  const escolher = (v: boolean) => {
    setErro(false)
    salvarEstimativaRm(uid, v).catch(() => setErro(true)) // sem await: offline a promessa só resolve no servidor
  }
  return (
    <Modal rotulo="Novidade: carga sugerida pelas repetições" aoFechar={() => escolher(false)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-marca-400">Novidade</p>
      <h2 className="mt-1 text-lg font-bold">Carga sugerida pelas suas repetições</h2>
      <p className="mt-2 text-sm text-slate-300">O app pode sugerir a carga a partir do que você já treinou, ajustada às repetições de hoje (inclusive com o histórico do ciclo anterior), com base em uma tabela de estudos científicos.</p>
      <div className="mt-3 rounded-xl bg-slate-800 p-3 text-sm">
        <p className="text-slate-400">Exemplo</p>
        <p className="font-semibold">60 kg × 10 repetições → <span className="text-emerald-300">63 kg</span> para 8 repetições</p>
      </div>
      <p className="mt-3 text-sm text-slate-400">É só uma sugestão: você digita a carga que usar. Dá para ligar ou desligar quando quiser em {onde}.</p>
      {erro && <Aviso>Não deu para salvar. Tente de novo.</Aviso>}
      <div className="mt-4 grid gap-2">
        <Botao tipo="primario" tamanho="lg" className="w-full" onClick={() => escolher(true)}>Ligar</Botao>
        <Botao tipo="fantasma" className="w-full" onClick={() => escolher(false)}>Agora não</Botao>
      </div>
    </Modal>
  )
}
