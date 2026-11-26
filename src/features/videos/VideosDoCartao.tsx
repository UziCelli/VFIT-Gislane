import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { lazy, Suspense, useState } from 'react'
import { IcCamera, IcSom } from '../../icones'
import { cancelarEnvio, enviarVideo, retomarEnvio, useEnvios } from '../../lib/envioVideo'
import { db } from '../../lib/firebase'
import { MAX_S_ALUNO, MAX_S_COACH, situacaoExecucao, type Resumo, type Sessao } from '../../lib/midias'
import type { Gravado } from './Gravador'

const Gravador = lazy(() => import('./Gravador'))
const PlayerPrivado = lazy(() => import('./PlayerPrivado'))

// Parte de vídeos privados do cartão do exercício (#253). Fechado = uma linha de botões; nada é baixado até tocar.
// Aluno: "Enviar minha execução" e a orientação mais recente do coach para este exercício (vale nos próximos treinos).
// Coach (presencial/cartão do aluno): "Enviar orientação", mesmo sem envio do aluno.
export default function VideosDoCartao({ alunoId, nome, exercicioId, sessao, coach, resumo }: {
  alunoId: string
  nome: string
  exercicioId: string
  sessao: Sessao
  coach: boolean
  resumo?: Resumo
}) {
  const [gravar, setGravar] = useState(false)
  const [ver, setVer] = useState(false)
  // Assina só os envios em andamento (o progresso redesenha esta linha, não o cartão nem o treino).
  const envios = useEnvios()
  const envio = [...envios.values()].find((e) => e.alunoId === alunoId && e.exercicioId === exercicioId && e.tipo === (coach ? 'orientacao' : 'execucao') && e.fase !== 'pronto')
  const orient = resumo?.orientacao
  const exec = resumo?.execucao
  const situacao = situacaoExecucao(resumo)
  const nova = !coach && orient && !orient.vistoEm

  const abrirOrientacao = () => {
    setVer((v) => !v)
    if (!coach && orient && !orient.vistoEm) void updateDoc(doc(db, 'midias', orient.id), { vistoEm: serverTimestamp() }).catch(() => {})
  }
  const mandar = (g: Gravado) =>
    enviarVideo(
      {
        tipo: coach ? 'orientacao' : 'execucao', alunoId, exercicioId, exercicio: nome, sessao, mime: g.mime, duracaoS: g.duracaoS,
        // Coach respondendo a um envio que ainda espera: vincula (tira da fila e mostra as marcações junto).
        ...(coach && exec && situacao === 'aguardando' ? { respondeA: exec.id } : {}),
      },
      g.arquivo,
    ).then(() => undefined)

  return (
    <div className="mb-2 space-y-2" data-videos-cartao>
      <div className="flex flex-wrap gap-2">
        {orient && (
          <button type="button" onClick={abrirOrientacao} aria-expanded={ver} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-amber-950/60 px-3 text-sm font-semibold text-amber-100 ring-1 ring-amber-400/60">
            <IcSom className="size-4" /> {ver ? 'Fechar orientação' : 'Orientação do coach'}
            {nova && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-bold text-slate-950">nova</span>}
          </button>
        )}
        {!envio && (coach || situacao !== 'aguardando') && (
          <button type="button" onClick={() => setGravar(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-slate-200 ring-1 ring-slate-600">
            <IcCamera className="size-4" /> {coach ? 'Enviar orientação' : 'Enviar minha execução'}
          </button>
        )}
      </div>
      {envio && (
        <div className="space-y-1.5 rounded-lg bg-slate-800/60 p-2" role="status">
          {envio.fase === 'enviando' ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span>Enviando vídeo · {Math.round(envio.progresso * 100)}%</span>
                <button type="button" onClick={() => void cancelarEnvio(envio.id)} className="min-h-11 px-2 text-sm text-slate-400 underline">Cancelar</button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-marca-400 transition-[width]" style={{ width: `${Math.round(envio.progresso * 100)}%` }} /></div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex-1 text-amber-200">{envio.erro ?? 'Envio parado.'}</span>
              <button type="button" onClick={() => void retomarEnvio(envio.id)} className="min-h-11 rounded-lg px-3 font-semibold text-marca-300 ring-1 ring-marca-400/60">Retomar</button>
              <button type="button" onClick={() => void cancelarEnvio(envio.id)} className="min-h-11 px-2 text-slate-400 underline">Cancelar</button>
            </div>
          )}
        </div>
      )}
      {!envio && !coach && situacao === 'aguardando' && <p className="text-sm text-slate-300" role="status">Vídeo enviado · Aguardando análise</p>}
      {!envio && coach && situacao === 'aguardando' && <p className="text-sm text-amber-200">Execução do aluno aguardando sua análise.</p>}
      {ver && orient && (
        <Suspense fallback={<p className="text-sm text-slate-400">Carregando…</p>}>
          <PlayerPrivado id={orient.id} titulo={`Orientação: ${nome}`} somAviso />
          {orient.respondeA && exec?.id === orient.respondeA && (exec.marcas?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Seu vídeo com as marcações do coach</p>
              <PlayerPrivado id={exec.id} titulo={`Sua execução: ${nome}`} marcas={exec.marcas} />
            </div>
          )}
        </Suspense>
      )}
      {gravar && (
        <Suspense fallback={null}>
          <Gravador
            titulo={coach ? 'Orientação para o aluno' : 'Enviar minha execução'}
            maxS={coach ? MAX_S_COACH : MAX_S_ALUNO}
            comAudio={coach}
            dica={coach ? 'Fale a orientação: o aluno ouve com som. Até 1 min e 30 s.' : `Filme uma série inteira de ${nome}, com o corpo todo aparecendo.`}
            enviar={mandar}
            fechar={() => setGravar(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
