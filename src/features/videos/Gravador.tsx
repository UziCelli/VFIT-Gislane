import { useEffect, useRef, useState } from 'react'
import { conferirArquivo, mimeOk, type Mime } from '../../lib/midias'
import { Botao, Modal } from '../../ui'

// Grava pelo app (câmera, bitrate baixo: 60 s ≈ 7 MB) ou escolhe da galeria. Depois mostra a prévia e só envia no
// "Enviar". O coach grava com microfone (orientação falada); o aluno sem áudio (só a execução).
export type Gravado = { arquivo: Blob; mime: Mime; duracaoS: number }

const MIME_GRAVACAO = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
const tipoGravacao = () => (typeof MediaRecorder === 'undefined' ? undefined : MIME_GRAVACAO.find((t) => MediaRecorder.isTypeSupported(t)))
const podeGravar = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!tipoGravacao()

// Duração do arquivo escolhido (webm gravado às vezes diz Infinity: aí vale a duração medida na gravação).
function duracaoDe(arquivo: Blob): Promise<number> {
  return new Promise((ok) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(arquivo)
    const fim = (d: number) => (URL.revokeObjectURL(url), ok(d))
    v.preload = 'metadata'
    v.onloadedmetadata = () => fim(Number.isFinite(v.duration) ? v.duration : 0)
    v.onerror = () => fim(0)
    v.src = url
  })
}

export default function Gravador({ titulo, maxS, comAudio, dica, enviar, fechar }: {
  titulo: string
  maxS: number
  comAudio: boolean
  dica?: string
  enviar: (g: Gravado) => Promise<void> | void
  fechar: () => void
}) {
  const [fase, setFase] = useState<'escolher' | 'gravando' | 'previa'>('escolher')
  const [frente, setFrente] = useState(false) // câmera de trás por padrão (outra pessoa filma); "Trocar câmera" vira
  const [seg, setSeg] = useState(0)
  const [erro, setErro] = useState('')
  const [gravado, setGravado] = useState<Gravado | null>(null)
  const [url, setUrl] = useState('')
  const [enviando, setEnviando] = useState(false)
  const ao = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const inicio = useRef(0)

  const pararCamera = () => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }
  useEffect(() => () => {
    rec.current?.state === 'recording' && rec.current.stop()
    pararCamera()
  }, [])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const usar = async (arquivo: Blob, tipo: string, medida?: number) => {
    const mime = mimeOk(tipo)
    const duracaoS = medida ?? (await duracaoDe(arquivo))
    const msg = conferirArquivo({ bytes: arquivo.size, tipo, duracaoS }, maxS)
    if (msg || !mime) return setErro(msg ?? 'Formato de vídeo não aceito.')
    setErro('')
    setGravado({ arquivo, mime, duracaoS })
    setUrl(URL.createObjectURL(arquivo))
    setFase('previa')
  }

  const gravar = async (deFrente = frente) => {
    setErro('')
    try {
      pararCamera()
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: deFrente ? 'user' : 'environment', width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } },
        audio: comAudio,
      })
    } catch {
      return setErro(comAudio ? 'Libere a câmera e o microfone para gravar.' : 'Libere a câmera para gravar.')
    }
    const tipo = tipoGravacao()!
    const r = new MediaRecorder(stream.current, { mimeType: tipo, videoBitsPerSecond: 900_000, ...(comAudio ? { audioBitsPerSecond: 64_000 } : {}) })
    const partes: Blob[] = []
    r.ondataavailable = (e) => e.data.size && partes.push(e.data)
    r.onstop = () => {
      const medida = (performance.now() - inicio.current) / 1000
      pararCamera()
      void usar(new Blob(partes, { type: tipo.split(';')[0] }), tipo, Math.min(medida, maxS))
    }
    rec.current = r
    setFase('gravando')
    setSeg(0)
    requestAnimationFrame(() => {
      if (ao.current) ao.current.srcObject = stream.current
    })
    inicio.current = performance.now()
    r.start(1000)
  }

  // Relógio da gravação; para sozinho no limite.
  useEffect(() => {
    if (fase !== 'gravando') return
    const t = setInterval(() => {
      const s = (performance.now() - inicio.current) / 1000
      setSeg(Math.floor(s))
      if (s >= maxS) rec.current?.state === 'recording' && rec.current.stop()
    }, 250)
    return () => clearInterval(t)
  }, [fase, maxS])

  const trocarCamera = () => {
    const nova = !frente
    setFrente(nova)
    if (rec.current?.state === 'recording') {
      rec.current.onstop = null
      rec.current.stop()
    }
    void gravar(nova)
  }

  const mandar = async () => {
    if (!gravado) return
    setEnviando(true)
    try {
      await enviar(gravado)
      fechar()
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não deu para enviar. Tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <Modal rotulo={titulo} aoFechar={fase === 'gravando' ? undefined : fechar}>
      <div className="space-y-3">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {dica && fase === 'escolher' && <p className="text-sm text-slate-300">{dica}</p>}
        {fase === 'escolher' && (
          <div className="grid gap-2">
            {podeGravar() && <Botao tipo="primario" onClick={() => void gravar()}>Gravar agora</Botao>}
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-semibold text-slate-100">
              Escolher da galeria
              <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void usar(f, f.type)
              }} />
            </label>
            <p className="text-xs text-slate-400">Até {maxS} s.{comAudio ? ' Com som.' : ''}</p>
          </div>
        )}
        {fase === 'gravando' && (
          <div className="space-y-2">
            <video ref={ao} autoPlay muted playsInline className="mx-auto max-h-[55vh] w-full rounded-xl bg-black object-contain" />
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-bold text-rose-300" role="timer"><span aria-hidden className="size-2.5 animate-pulse rounded-full bg-rose-400" /> Gravando · {seg} s de {maxS} s</span>
              <button type="button" onClick={trocarCamera} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-300 ring-1 ring-slate-700">Trocar câmera</button>
            </div>
            <Botao tipo="perigo" className="w-full" onClick={() => rec.current?.state === 'recording' && rec.current.stop()}>Parar</Botao>
          </div>
        )}
        {fase === 'previa' && gravado && (
          <div className="space-y-2">
            <video src={url} controls playsInline className="mx-auto max-h-[55vh] w-full rounded-xl bg-black object-contain" />
            <p className="text-xs text-slate-400">{Math.round(gravado.duracaoS)} s · {(gravado.arquivo.size / 1048576).toFixed(1)} MB</p>
            <div className="flex gap-2">
              <Botao tipo="primario" className="flex-1" carregando={enviando} disabled={enviando} onClick={() => void mandar()}>Enviar</Botao>
              <Botao tipo="secundario" disabled={enviando} onClick={() => (setGravado(null), setFase('escolher'))}>Refazer</Botao>
            </div>
          </div>
        )}
        <p role="alert" className="text-sm text-red-300">{erro}</p>
        {fase !== 'gravando' && <Botao tipo="fantasma" className="w-full" disabled={enviando} onClick={fechar}>Cancelar</Botao>}
      </div>
    </Modal>
  )
}
