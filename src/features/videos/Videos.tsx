import { collection } from 'firebase/firestore'
import { useMemo, useState } from 'react'
import { IcPlay } from '../../icones'
import { gravarVideo } from '../../lib/acoes'
import { db } from '../../lib/firebase'
import { TEXTO_SEM_INTERNET, useLista, useSemInternet } from '../../lib/hooks'
import { registrarErro } from '../../lib/log'
import { contarVideos, dadosVideo, filtrarVideos, linhasVideos, MAX_LINK, MAX_NOTA, rotuloStatus, STATUS_VIDEO, type DocVideo, type LinhaVideo, type StatusVideo } from '../../lib/videos'
import { Barra, Botao, Campo, Cartao, classesOpcao, Msg } from '../../ui'

// Aba Consultas > Vídeos (só coach): o que falta gravar, o que foi gravado e o que já está no ar.
// O vídeo fica no YouTube como "não listado" (sem custo); aqui só o status, o link e uma nota. Regras em lib/videos.ts.
const PASSO = 60 // linhas por vez: a lista "A gravar" começa com o catálogo inteiro

// `confirmado`: a lista veio do servidor. Só do cache (sem internet), um exercício que parece "A gravar" pode já ter
// link e nota no servidor, e salvar (setDoc do doc inteiro) os apagaria ao reconectar: aí não salva.
function Editor({ l, nome, confirmado, fechar, aviso }: { l: LinhaVideo; nome: string; confirmado: boolean; fechar: () => void; aviso: (t: string) => void }) {
  const [status, setStatus] = useState<StatusVideo>(l.status === 'gravar' ? 'gravado' : l.status)
  const [link, setLink] = useState(l.link ?? '')
  const [nota, setNota] = useState(l.nota ?? '')
  const [erro, setErro] = useState('')
  const salvar = () => {
    if (!confirmado) return setErro('Sem internet. Conecte-se para salvar.')
    const r = dadosVideo(status, link, nota, nome)
    if (r?.erro) return setErro(r.erro)
    // Sem await: offline, o cache local já mostra; a promessa só resolve quando o servidor confirma.
    gravarVideo(l.id, r?.dados ?? null).catch((e) => {
      registrarErro('gravacao', `videos: ${e?.code ?? e}`, e)
      aviso('Não deu para salvar. Tente de novo.')
    })
    aviso(`${l.nome}: ${rotuloStatus(status)}`)
    fechar()
  }
  return (
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
      <div role="radiogroup" aria-label="Situação do vídeo" className="grid grid-cols-3 gap-2">
        {STATUS_VIDEO.map((s) => (
          <button key={s.id} role="radio" aria-checked={status === s.id} onClick={() => setStatus(s.id)} className={classesOpcao(status === s.id, 'min-h-11 rounded-xl text-sm')}>
            {s.rotulo}
          </button>
        ))}
      </div>
      {status !== 'gravar' && (
        <>
          <div>
            <Campo rotulo="Link do vídeo" type="url" inputMode="url" placeholder="https://youtu.be/…" maxLength={MAX_LINK} value={link} onChange={(e) => setLink(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Suba no YouTube como "não listado" e cole o link. No ar, o aluno vê o vídeo e a nota.</p>
          </div>
          <Campo rotulo="Nota (opcional)" placeholder="Ex.: regravar com luz melhor" maxLength={MAX_NOTA} value={nota} onChange={(e) => setNota(e.target.value)} />
        </>
      )}
      <Msg className="text-sm text-red-300">{erro}</Msg>
      <div className="flex gap-2">
        <Botao tipo="primario" onClick={salvar}>Salvar</Botao>
        <Botao tipo="fantasma" onClick={fechar}>Cancelar</Botao>
      </div>
    </div>
  )
}

export default function Videos({ nome }: { nome: string }) {
  const r = useLista<DocVideo>(useMemo(() => collection(db, 'videos'), []))
  const semInternet = useSemInternet()
  const [filtro, setFiltro] = useState<StatusVideo>('gravar')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  const [limite, setLimite] = useState(PASSO)
  const [msg, setMsg] = useState('')
  const linhas = useMemo(() => linhasVideos(r.dados), [r.dados])
  const n = contarVideos(linhas)
  const lista = filtrarVideos(linhas, filtro, busca)
  const gravados = n.gravado + n.noAr
  const qtd: Record<StatusVideo, number> = { gravar: n.gravar, gravado: n.gravado, 'no-ar': n.noAr }
  const trocarFiltro = (s: StatusVideo) => {
    setFiltro(s)
    setAberto(null)
    setLimite(PASSO)
  }

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold">Vídeos</h1>
      {r.erro ? (
        <p className="text-sm text-red-300">Não deu para carregar os vídeos.</p>
      ) : r.carregando || (r.cache && r.dados.length === 0) ? (
        // Cache vazio não quer dizer "nada gravado": sem confirmação do servidor, não mostra tudo como "A gravar".
        <p className="text-sm text-slate-400">{semInternet ? TEXTO_SEM_INTERNET : 'Carregando…'}</p>
      ) : (
        <>
          <Cartao className="mb-3">
            <p className="text-base font-bold">
              {gravados} de {n.total} gravados
            </p>
            <p className="text-xs text-slate-400">
              {n.noAr} no ar · {n.gravado} falta subir · {n.gravar} a gravar
            </p>
            <Barra frac={n.total ? gravados / n.total : 0} />
          </Cartao>

          <div role="radiogroup" aria-label="Mostrar" className="mb-3 grid grid-cols-3 gap-2">
            {STATUS_VIDEO.map((s) => (
              <button key={s.id} role="radio" aria-checked={filtro === s.id} onClick={() => trocarFiltro(s.id)} className={classesOpcao(filtro === s.id, 'min-h-11 rounded-xl text-sm')}>
                {s.rotulo} · {qtd[s.id]}
              </button>
            ))}
          </div>
          <Campo rotulo="Buscar exercício ou grupo" type="search" value={busca} onChange={(e) => (setBusca(e.target.value), setLimite(PASSO))} className="mb-3" />
          <Msg className="mb-3 text-sm text-emerald-300">{msg}</Msg>

          {lista.length === 0 ? (
            <p className="text-sm text-slate-400">{busca ? 'Nenhum exercício com esse nome aqui.' : filtro === 'gravar' ? 'Tudo gravado.' : 'Nenhum exercício aqui ainda.'}</p>
          ) : (
            <ul className="space-y-2">
              {lista.slice(0, limite).map((l) => (
                <li key={l.id}>
                  <Cartao className="p-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setAberto(aberto === l.id ? null : l.id)} aria-expanded={aberto === l.id} className="min-h-11 min-w-0 flex-1 text-left">
                        <span className="block text-sm font-semibold">{l.nome}</span>
                        <span className="block text-xs text-slate-400">
                          {l.grupo}
                          {l.nota ? ` · ${l.nota}` : ''}
                        </span>
                      </button>
                      {l.link && (
                        <a href={l.link} target="_blank" rel="noreferrer" aria-label={`Ver vídeo: ${l.nome}`} className="grid size-11 shrink-0 place-items-center rounded-xl text-marca-300 hover:text-white">
                          <IcPlay className="size-5" />
                        </a>
                      )}
                    </div>
                    {aberto === l.id && <Editor l={l} nome={nome} confirmado={!r.cache} fechar={() => setAberto(null)} aviso={setMsg} />}
                  </Cartao>
                </li>
              ))}
            </ul>
          )}
          {lista.length > limite && (
            <Botao className="mt-3 w-full" onClick={() => setLimite((x) => x + PASSO)}>
              Mostrar mais ({lista.length - limite})
            </Botao>
          )}
        </>
      )}
    </div>
  )
}
