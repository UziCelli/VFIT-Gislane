import { salvarEstimativaRm } from '../../lib/acoes'
import { Chave } from './ChavesAvisos'

// Chave "Carga sugerida pelas repetições" (aluno em Conta, coach em Minha conta). Guarda no próprio perfil.
// Desligada ou ainda sem escolha = o número cinza é o da última vez, sem ajuste (docs/estimativa-rm.md).
export default function ChaveEstimativaRm({ uid, ligada, falhou }: { uid: string; ligada: boolean; falhou?: () => void }) {
  return (
    <div className="space-y-1">
      <div className="flex min-h-12 items-center gap-3">
        <span className="flex-1 text-base font-semibold">Carga sugerida pelas repetições</span>
        <Chave ligada={ligada} rotulo="Carga sugerida pelas repetições" onChange={(v) => salvarEstimativaRm(uid, v).catch(() => falhou?.())} />
      </div>
      <p className="text-sm text-slate-400">Ajusta a carga em cinza ao número de repetições do treino de hoje. É só uma sugestão: você digita a carga que usar.</p>
    </div>
  )
}
