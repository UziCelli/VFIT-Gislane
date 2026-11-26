import { useEffect, useRef, useState, type RefObject } from 'react'
import { IcSom } from '../../icones'
import { linkVideo } from '../../lib/envioVideo'
import { marcasNoTempo, momentosMarcados, type Marca } from '../../lib/midias'

// Área do quadro dentro do <video> (object-contain deixa faixas pretas): as marcas usam coordenadas 0..1 do quadro.
export function areaDoQuadro(v: HTMLVideoElement) {
  const W = v.clientWidth
  const H = v.clientHeight
  const vw = v.videoWidth || W
  const vh = v.videoHeight || H
  const e = Math.min(W / vw, H / vh)
  const w = vw * e
  const h = vh * e
  return { x: (W - w) / 2, y: (H - h) / 2, w, h, W, H }
}

const COR = '#f43f5e' // rosa-500: só para marcação (não é cor de método)

// Desenha as marcas do instante t por cima do vídeo (camada; o arquivo original não muda).
export function desenhar(c: HTMLCanvasElement, v: HTMLVideoElement, marcas: Marca[], t: number, extra?: Marca) {
  const a = areaDoQuadro(v)
  const dpr = window.devicePixelRatio || 1
  if (c.width !== Math.round(a.W * dpr) || c.height !== Math.round(a.H * dpr)) {
    c.width = Math.round(a.W * dpr)
    c.height = Math.round(a.H * dpr)
  }
  const g = c.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, a.W, a.H)
  g.strokeStyle = COR
  g.fillStyle = COR
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.lineWidth = Math.max(3, a.w / 120)
  const X = (x: number) => a.x + x * a.w
  const Y = (y: number) => a.y + y * a.h
  for (const m of [...marcasNoTempo(marcas, t), ...(extra ? [extra] : [])]) {
    if (m.k === 'ponto') {
      g.beginPath()
      g.arc(X(m.p[0]), Y(m.p[1]), Math.max(8, a.w / 40), 0, Math.PI * 2)
      g.globalAlpha = 0.35
      g.fill()
      g.globalAlpha = 1
      g.stroke()
    } else {
      g.beginPath()
      g.moveTo(X(m.p[0]), Y(m.p[1]))
      for (let i = 2; i < m.p.length; i += 2) g.lineTo(X(m.p[i]), Y(m.p[i + 1]))
      g.stroke()
    }
  }
}

// Redesenha enquanto o vídeo toca (só com marcas): requestAnimationFrame + eventos de pausa/pulo.
// `src`: o <video> só existe depois que o link chega; trocar o src refaz a ligação.
export function useCamada(v: RefObject<HTMLVideoElement | null>, c: RefObject<HTMLCanvasElement | null>, marcas: Marca[], src: string, extra?: Marca) {
  useEffect(() => {
    const video = v.current
    const tela = c.current
    if (!video || !tela) return
    let raf = 0
    const pintar = () => desenhar(tela, video, marcas, video.currentTime, extra)
    const loop = () => {
      pintar()
      if (!video.paused) raf = requestAnimationFrame(loop)
    }
    const eventos = ['play', 'pause', 'seeked', 'loadedmetadata', 'timeupdate'] as const
    const aoEvento = () => (cancelAnimationFrame(raf), loop())
    eventos.forEach((e) => video.addEventListener(e, aoEvento))
    const ro = new ResizeObserver(pintar)
    ro.observe(video)
    pintar()
    return () => {
      cancelAnimationFrame(raf)
      eventos.forEach((e) => video.removeEventListener(e, aoEvento))
      ro.disconnect()
    }
  }, [v, c, marcas, src, extra])
}

// Vídeo privado: pede o link curto ao Worker só quando monta (o cartão só monta ao tocar). `somAviso` = orientação
// falada: mostra "Ligue o som". Com marcas, desenha por cima e oferece os momentos marcados.
export default function PlayerPrivado({ id, titulo, somAviso, marcas = [] }: { id: string; titulo: string; somAviso?: boolean; marcas?: Marca[] }) {
  const [url, setUrl] = useState('')
  const [erro, setErro] = useState('')
  const v = useRef<HTMLVideoElement>(null)
  const c = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let vivo = true
    linkVideo(id).then((u) => vivo && setUrl(u)).catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Não deu para abrir o vídeo.'))
    return () => {
      vivo = false
    }
  }, [id])
  useCamada(v, c, marcas, url)
  const momentos = momentosMarcados(marcas)
  const ir = (t: number) => {
    if (!v.current) return
    v.current.pause()
    v.current.currentTime = t
  }
  if (erro) return <p role="alert" className="text-sm text-amber-200">{erro}</p>
  return (
    <div className="space-y-2">
      {somAviso && <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200" data-ligue-som><IcSom className="size-5" /> Ligue o som</p>}
      <div className="relative overflow-hidden rounded-xl bg-black">
        {!url && <p className="grid aspect-video place-items-center text-sm text-slate-400">Carregando vídeo…</p>}
        {url && <video ref={v} src={url} title={titulo} controls playsInline preload="metadata" className="max-h-[60vh] w-full object-contain" />}
        {marcas.length > 0 && <canvas ref={c} aria-hidden className="pointer-events-none absolute inset-0 size-full" />}
      </div>
      {momentos.length > 0 && url && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          Marcações:
          {momentos.map((t) => (
            <button key={t} type="button" onClick={() => ir(t)} className="min-h-11 rounded-full px-3 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/60">
              {t.toFixed(1)} s
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
