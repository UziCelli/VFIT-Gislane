import { collection, doc, query, updateDoc, where } from 'firebase/firestore'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { IcCamera } from '../../icones'
import { cancelarEnvio, enviarVideo, envioPendentes, linkVideo, retomarEnvio, useEnvios } from '../../lib/envioVideo'
import { auth, db } from '../../lib/firebase'
import { TEXTO_SEM_INTERNET, useDoc, useLista, useSemInternet } from '../../lib/hooks'
import { apagarPerto, filaDoCoach, limparMarcas, MAX_MARCAS, MAX_S_COACH, simplificar, type DocMidia, type Marca } from '../../lib/midias'
import type { Usuario } from '../../lib/acesso'
import { registrarErro } from '../../lib/log'
import { BotaoVoltar } from '../../voltar'
import { Botao, Cartao, classesOpcao, Pagina } from '../../ui'
import { areaDoQuadro, useCamada } from './PlayerPrivado'
import type { Gravado } from './Gravador'

const Gravador = lazy(() => import('./Gravador'))

const data = (d: DocMidia) => {
  const ms = d.prontoEm?.toMillis?.() ?? d.em?.toMillis?.()
  return ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}

// Fila do coach (#253): execuções enviadas pelos alunos que ainda esperam análise. Mais antigas primeiro.
export function useFilaExecucoes() {
  const r = useLista<DocMidia>(useMemo(() => query(collection(db, 'midias'), where('tipo', '==', 'execucao'), where('respondida', '==', false)), []))
  return { ...r, fila: filaDoCoach(r.dados) }
}

export function FilaExecucoes() {
  const { fila, carregando, erro } = useFilaExecucoes()
  const alunos = useLista<Usuario>(useMemo(() => query(collection(db, 'usuarios'), where('papel', '==', 'aluno')), []))
  const nomes = new Map(alunos.dados.map((a) => [a.id, a.nome]))
  const semInternet = useSemInternet()
  return (
    <Pagina titulo="Execuções para analisar" voltar={<BotaoVoltar para="/" />}>
      {semInternet && <p className="mb-3 text-sm text-amber-200">{TEXTO_SEM_INTERNET}</p>}
      {carregando ? <p className="text-sm text-slate-400">Carregando…</p>
        : erro ? <p className="text-sm text-amber-200">Não deu para carregar a fila. Tente de novo.</p>
        : fila.length === 0 ? <p className="text-sm text-slate-300">Nenhum vídeo esperando análise.</p>
        : (
          <ul className="space-y-2 lg:max-w-xl">
            {fila.map((d) => (
              <li key={d.id}>
                <a href={`#/execucao/${d.id}`} className="flex min-h-11 flex-col rounded-xl border border-slate-700 bg-slate-900 p-3">
                  <span className="font-semibold">{nomes.get(d.alunoId) ?? 'Aluno'} · {d.exercicio}</span>
                  <span className="text-xs text-slate-400">{data(d)} · {Math.round(d.duracaoS)} s · Treino {d.sessao.treino}, semana {d.sessao.semana}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
    </Pagina>
  )
}

type Ferramenta = 'caneta' | 'ponto' | 'borracha'

// Revisão: assistir, pausar e marcar (caneta, ponto, borracha) por cima do quadro; gravar a orientação falada.
// As marcações ficam no documento (tempo + coordenadas 0..1); o vídeo original não é alterado nem reprocessado.
export function RevisarExecucao({ id }: { id: string }) {
  const { dados: d, carregando } = useDoc<Omit<DocMidia, 'id'>>(doc(db, 'midias', id))
  const { dados: aluno } = useDoc<Usuario>(d ? doc(db, 'usuarios', d.alunoId) : null)
  const [url, setUrl] = useState('')
  const [erro, setErro] = useState('')
  const [marcas, setMarcas] = useState<Marca[] | null>(null)
  const [historico, setHistorico] = useState<Marca[][]>([])
  const [ferr, setFerr] = useState<Ferramenta | null>(null)
  const [traco, setTraco] = useState<Marca | undefined>()
  const [msg, setMsg] = useState('')
  const [gravar, setGravar] = useState(false)
  const v = useRef<HTMLVideoElement>(null)
  const c = useRef<HTMLCanvasElement>(null)
  const envio = [...useEnvios().values()].find((e) => e.tipo === 'orientacao' && d && e.alunoId === d.alunoId && e.exercicioId === d.exercicioId && e.fase !== 'pronto')

  // Orientação que ficou no aparelho (app fechado no meio do envio) aparece aqui para retomar.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) void envioPendentes(uid)
  }, [])
  useEffect(() => {
    let vivo = true
    linkVideo(id).then((u) => vivo && setUrl(u)).catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Não deu para abrir o vídeo.'))
    return () => {
      vivo = false
    }
  }, [id])
  // Marcações salvas entram uma vez; depois o coach edita localmente e salva.
  useEffect(() => {
    if (d && marcas === null) setMarcas(limparMarcas(d.marcas))
  }, [d, marcas])
  const lista = marcas ?? []
  useCamada(v, c, lista, url, traco)

  const mudar = (nova: Marca[]) => {
    setHistorico((h) => [...h.slice(-30), lista])
    setMarcas(nova.slice(0, MAX_MARCAS))
  }
  const ponto = (e: PointerEvent<HTMLCanvasElement>) => {
    const a = areaDoQuadro(v.current!)
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left - a.x) / a.w
    const y = (e.clientY - r.top - a.y) / a.h
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? [x, y] : null
  }
  const tempo = () => Math.round((v.current?.currentTime ?? 0) * 10) / 10
  const baixar = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = ponto(e)
    if (!p || !ferr) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (ferr === 'ponto') mudar([...lista, { t: tempo(), k: 'ponto', p: p.map((x) => Math.round(x * 1000) / 1000) }])
    else if (ferr === 'borracha') mudar(apagarPerto(lista, tempo(), p[0], p[1]))
    else setTraco({ t: tempo(), k: 'caneta', p })
  }
  const mover = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!traco) return
    const p = ponto(e)
    if (p) setTraco({ ...traco, p: [...traco.p, ...p] })
  }
  const soltar = () => {
    if (traco && traco.p.length >= 4) mudar([...lista, { ...traco, p: simplificar(traco.p) }])
    setTraco(undefined)
  }
  const escolher = (f: Ferramenta) => {
    v.current?.pause()
    setFerr((x) => (x === f ? null : f))
  }
  const salvar = async () => {
    try {
      await updateDoc(doc(db, 'midias', id), { marcas: limparMarcas(lista) })
      setMsg('Marcações salvas.')
    } catch (e) {
      registrarErro('gravacao', `midias marcas: ${(e as { code?: string })?.code ?? e}`, e)
      setMsg('Não deu para salvar. Tente de novo.')
    }
  }
  const mandar = async (g: Gravado) => {
    if (!d) return
    if (marcas && JSON.stringify(limparMarcas(d.marcas)) !== JSON.stringify(limparMarcas(lista))) await salvar()
    await enviarVideo({ tipo: 'orientacao', alunoId: d.alunoId, exercicioId: d.exercicioId, exercicio: d.exercicio, sessao: d.sessao, mime: g.mime, duracaoS: g.duracaoS, respondeA: id }, g.arquivo)
  }

  if (carregando) return <Pagina titulo="Execução" voltar={<BotaoVoltar para="/execucoes" />}><p className="text-sm text-slate-400">Carregando…</p></Pagina>
  if (!d) return <Pagina titulo="Execução" voltar={<BotaoVoltar para="/execucoes" />}><p className="text-sm text-slate-300">Vídeo não encontrado.</p></Pagina>
  return (
    <Pagina titulo={d.exercicio} voltar={<BotaoVoltar para="/execucoes" />}>
      <div className="space-y-3 lg:max-w-xl">
        <p className="text-sm text-slate-300">{aluno?.nome ?? 'Aluno'} · {data({ ...d, id })} · Treino {d.sessao.treino}, semana {d.sessao.semana}{d.respondida ? ' · respondida' : ''}</p>
        {erro ? <p role="alert" className="text-sm text-amber-200">{erro}</p> : (
          <div className="relative overflow-hidden rounded-xl bg-black" data-revisao>
            {!url && <p className="grid aspect-video place-items-center text-sm text-slate-400">Carregando vídeo…</p>}
            {url && <video ref={v} src={url} controls={!ferr} playsInline preload="metadata" className="max-h-[60vh] w-full object-contain" />}
            <canvas
              ref={c}
              aria-label={ferr ? `Marcar com ${ferr}` : undefined}
              className={`absolute inset-0 size-full touch-none ${ferr ? '' : 'pointer-events-none'}`}
              onPointerDown={baixar}
              onPointerMove={mover}
              onPointerUp={soltar}
              onPointerCancel={soltar}
            />
          </div>
        )}
        <div role="toolbar" aria-label="Marcação" className="flex flex-wrap gap-2">
          {(['caneta', 'ponto', 'borracha'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={ferr === f} onClick={() => escolher(f)} className={classesOpcao(ferr === f, 'min-h-11 rounded-xl px-3 text-sm capitalize')}>{f}</button>
          ))}
          <button type="button" disabled={!historico.length} onClick={() => (setMarcas(historico[historico.length - 1]), setHistorico((h) => h.slice(0, -1)))} className="min-h-11 rounded-xl px-3 text-sm text-slate-300 ring-1 ring-slate-700 disabled:opacity-40">Desfazer</button>
        </div>
        <p className="text-xs text-slate-400">{ferr ? 'Vídeo pausado: marque no quadro. Toque de novo na ferramenta para voltar a assistir.' : 'Pause no momento certo e escolha uma ferramenta.'} {lista.length} marcações.</p>
        <div className="flex flex-wrap gap-2">
          <Botao tipo="secundario" onClick={() => void salvar()}>Salvar marcações</Botao>
          {!envio && <Botao tipo="primario" onClick={() => setGravar(true)}><span className="inline-flex items-center gap-2"><IcCamera className="size-5" /> Gravar orientação</span></Botao>}
        </div>
        {envio && (
          <Cartao className="space-y-1 text-sm" >
            {envio.fase === 'enviando' ? <span role="status">Enviando orientação · {Math.round(envio.progresso * 100)}%</span> : (
              <span className="flex flex-wrap items-center gap-2"><span className="flex-1 text-amber-200">{envio.erro}</span>
                <button type="button" onClick={() => void retomarEnvio(envio.id)} className="min-h-11 px-2 font-semibold text-marca-300 underline">Retomar</button>
                <button type="button" onClick={() => void cancelarEnvio(envio.id)} className="min-h-11 px-2 text-slate-400 underline">Cancelar</button>
              </span>
            )}
          </Cartao>
        )}
        <p role="status" className="text-sm text-slate-300">{msg}</p>
      </div>
      {gravar && (
        <Suspense fallback={null}>
          <Gravador titulo="Orientação para o aluno" maxS={MAX_S_COACH} comAudio dica="Fale a orientação: o aluno ouve com som e vê suas marcações. Até 1 min e 30 s." enviar={mandar} fechar={() => setGravar(false)} />
        </Suspense>
      )}
    </Pagina>
  )
}
