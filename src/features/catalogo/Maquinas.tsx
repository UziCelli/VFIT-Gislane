import { useMemo, useState } from 'react'
import { EXERCICIOS_ATIVOS } from '../../data/catalogo'
import type { RazaoPolia, Unidade } from '../../engine/aparelho'
import { apagarMaquina, gravarMaquina } from '../../lib/acoes'
import { norm } from '../../lib/busca'
import { TEXTO_SEM_INTERNET, useSemInternet } from '../../lib/hooks'
import { registrarErro } from '../../lib/log'
import {
  LIMITES, lerNumero, lerPlaquinhas, locais, nomeDoExercicio, paraEntrada, resumoEscala, TIPOS_MAQUINA, validarMaquina,
  type EntradaMaquina, type Maquina, type TipoMaquina,
} from '../../lib/maquinas'
import { Botao, Campo, Cartao, classesOpcao, Msg } from '../../ui'
import { BotaoVoltar } from '../../voltar'
import { useExerciciosProprios } from './useProprios'
import { useMaquinas } from './useMaquinas'

// Máquinas da academia (épico #255, etapa 5 #260), só coach: cadastrar cada máquina com a escala dela (kg ou nível,
// degraus, plaquinhas, polia 2:1, por lado) e ligar aos exercícios em que ela é usada. A carga por máquina vem na #262.
const txt = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','))

function Opcoes<T extends string>({ rotulo, valor, opcoes, mudar, cols }: { rotulo: string; valor: T; opcoes: readonly { id: T; rotulo: string; apoio?: string }[]; mudar: (v: T) => void; cols: string }) {
  return (
    <div>
      <p className="mb-1 text-sm text-slate-400">{rotulo}</p>
      <div role="radiogroup" aria-label={rotulo} className={`grid gap-2 ${cols}`}>
        {opcoes.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} onClick={() => mudar(o.id)} className={classesOpcao(valor === o.id, 'min-h-11 rounded-xl px-1 text-sm leading-tight')}>
            {o.rotulo}
            {o.apoio && <span className="block text-[11px] font-normal opacity-75">{o.apoio}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// Busca de exercício para ligar à máquina: catálogo base + cadastrados pelo coach.
function EscolherExercicios({ ids, mudar, proprios }: { ids: string[]; mudar: (ids: string[]) => void; proprios: readonly { id: string; nome: string }[] }) {
  const [busca, setBusca] = useState('')
  const todos = useMemo(() => [...proprios.map((p) => ({ id: p.id, nome: p.nome })), ...EXERCICIOS_ATIVOS.map((e) => ({ id: e.id, nome: e.nome }))], [proprios])
  const termos = norm(busca).trim().split(/\s+/).filter(Boolean)
  const achados = termos.length ? todos.filter((e) => !ids.includes(e.id) && termos.every((t) => norm(e.nome).includes(t))).slice(0, 6) : []
  return (
    <div>
      <Campo rotulo="Exercícios feitos nela" type="search" placeholder="Buscar exercício" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {achados.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-slate-700">
          {achados.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => (mudar([...ids, e.id]), setBusca(''))} className="flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-slate-800">
                + {e.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      {termos.length > 0 && achados.length === 0 && <p className="mt-1 text-xs text-slate-400">Nenhum exercício com esse nome.</p>}
      {ids.length > 0 ? (
        <ul aria-label="Exercícios ligados" className="mt-2 flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const nome = nomeDoExercicio(id) ?? 'Exercício removido'
            return (
              <li key={id}>
                <button type="button" aria-label={`Tirar ${nome}`} onClick={() => mudar(ids.filter((x) => x !== id))} className="flex min-h-9 items-center gap-1.5 rounded-full border border-slate-600 px-3 text-xs text-slate-200">
                  {nome} <span aria-hidden className="text-slate-400">✕</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Nenhum ainda. A sugestão de carga vai usar esta ligação.</p>
      )}
    </div>
  )
}

const VAZIA: EntradaMaquina = { nome: '', local: '', tipo: 'maquina', unidade: 'nivel', porLado: false, exercicios: [] }

function Formulario({ inicial, existentes, nome, confirmado, fechar, aviso }: {
  inicial: Maquina | null; existentes: readonly Maquina[]; nome: string; confirmado: boolean; fechar: () => void; aviso: (t: string) => void
}) {
  const proprios = useExerciciosProprios().lista
  const ini = inicial ? paraEntrada(inicial) : { ...VAZIA, local: locais(existentes)[0] ?? '', pilhaIrregular: false }
  const [f, setF] = useState(ini)
  const [n, setN] = useState({
    incremento: txt(ini.incremento), minimo: txt(ini.minimo), maximo: txt(ini.maximo), complementos: (ini.complementos ?? []).map(txt).join(' '),
    niveis: txt(ini.niveis), kgTopo: txt(ini.kgTopo), kgPlaca: txt(ini.kgPlaca),
  })
  const [erro, setErro] = useState('')
  const mudar = (x: Partial<EntradaMaquina>) => (setF((a) => ({ ...a, ...x })), setErro(''))
  const num = (k: keyof typeof n) => ({ value: n[k], inputMode: 'decimal' as const, onChange: (e: { target: { value: string } }) => (setN((a) => ({ ...a, [k]: e.target.value })), setErro('')) })
  const polia = f.tipo === 'polia' || f.tipo === 'duasPolias'
  const sugestoes = locais(existentes)

  const salvar = () => {
    if (!confirmado) return setErro('Sem internet. Conecte-se para salvar.')
    const plaquinhas = lerPlaquinhas(n.complementos)
    if (plaquinhas == null) return setErro('Plaquinhas: escreva só números (ex.: 0,625 0,625).')
    const niveis = lerNumero(n.niveis)
    const entrada: EntradaMaquina = {
      ...f,
      polia: polia ? f.polia : undefined,
      ...(f.unidade === 'kg'
        ? { incremento: lerNumero(n.incremento), minimo: lerNumero(n.minimo), maximo: lerNumero(n.maximo), complementos: plaquinhas, niveis: undefined, kgTopo: undefined, kgPlaca: undefined }
        : { niveis, kgTopo: lerNumero(n.kgTopo), kgPlaca: lerNumero(n.kgPlaca), incremento: undefined, minimo: undefined, maximo: undefined, complementos: undefined }),
    }
    const r = validarMaquina(entrada, existentes, nome, inicial?.id)
    if ('erro' in r) return setErro(r.erro ?? '')
    gravarMaquina(r.id, { ...r.dados }).catch((e) => {
      registrarErro('gravacao', `maquinas: ${e?.code ?? e}`, e)
      aviso('Não deu para salvar. Tente de novo.')
    })
    aviso(`${inicial ? 'Atualizada' : 'Cadastrada'}: ${r.dados.nome}`)
    fechar()
  }

  return (
    <Cartao className="mb-3 space-y-3 p-3">
      <p className="text-base font-bold">{inicial ? 'Editar máquina' : 'Adicionar máquina'}</p>
      <Campo rotulo="Nome" placeholder="Ex.: Cadeira Extensora" maxLength={LIMITES.nome} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} />
      <Campo rotulo="Onde fica" placeholder="Ex.: Academia Centro" maxLength={LIMITES.local} list="locais-maquinas" value={f.local} onChange={(e) => mudar({ local: e.target.value })} />
      <datalist id="locais-maquinas">{sugestoes.map((l) => <option key={l} value={l} />)}</datalist>
      <Opcoes rotulo="Tipo" valor={f.tipo} opcoes={TIPOS_MAQUINA} mudar={(tipo: TipoMaquina) => mudar({ tipo })} cols="grid-cols-4" />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Marca (opcional)" placeholder="Ex.: Movement" maxLength={LIMITES.rotulo} value={f.fabricante ?? ''} onChange={(e) => mudar({ fabricante: e.target.value })} />
        <Campo rotulo="Modelo (opcional)" placeholder="Ex.: W4" maxLength={LIMITES.rotulo} value={f.modelo ?? ''} onChange={(e) => mudar({ modelo: e.target.value })} />
      </div>

      <Opcoes<Unidade> rotulo="O aluno anota" valor={f.unidade} opcoes={[{ id: 'nivel', rotulo: 'Nível (pino)', apoio: 'sem kg escrito' }, { id: 'kg', rotulo: 'Kg', apoio: 'kg escrito na placa' }]} mudar={(unidade) => mudar({ unidade })} cols="grid-cols-2" />
      {f.unidade === 'kg' ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Campo rotulo="Sobe de (kg)" placeholder="5" {...num('incremento')} />
            <Campo rotulo="Mínimo" placeholder="opcional" {...num('minimo')} />
            <Campo rotulo="Máximo" placeholder="opcional" {...num('maximo')} />
          </div>
          <div>
            <Campo rotulo="Plaquinhas extras (kg, opcional)" placeholder="Ex.: 0,625 0,625" value={n.complementos} inputMode="decimal" onChange={(e) => (setN((a) => ({ ...a, complementos: e.target.value })), setErro(''))} />
            <p className="mt-1 text-xs text-slate-400">As que somam por cima do degrau. Até 4.</p>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Campo rotulo="Níveis" placeholder="12" {...num('niveis')} />
            <Campo rotulo="Nível 1 ≈ kg" placeholder="opcional" {...num('kgTopo')} />
            <Campo rotulo="+ kg por nível" placeholder="opcional" {...num('kgPlaca')} />
          </div>
          <p className="text-xs text-slate-400">Sem kg, o app não sugere carga nesta máquina: você sugere o nível.</p>
          {f.pilhaIrregular && <p className="text-xs text-amber-300">Esta pilha tinha kg diferentes por nível. Salvar troca pela conta acima.</p>}
        </>
      )}
      {polia && (
        <Opcoes<RazaoPolia> rotulo="Polia" valor={f.polia ?? '1:1'} opcoes={[{ id: '1:1', rotulo: '1:1', apoio: 'puxa o que marca' }, { id: '2:1', rotulo: '2:1', apoio: 'puxa a metade' }]} mudar={(p) => mudar({ polia: p })} cols="grid-cols-2" />
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={f.porLado} onChange={(e) => mudar({ porLado: e.target.checked })} className="size-5 accent-marca-500" />
        Carga anotada por lado
      </label>
      <EscolherExercicios ids={f.exercicios} mudar={(exercicios) => mudar({ exercicios })} proprios={proprios} />
      <Campo rotulo="Observação (opcional)" placeholder="Ex.: pino à direita do banco" maxLength={LIMITES.obs} value={f.obs ?? ''} onChange={(e) => mudar({ obs: e.target.value })} />
      <Msg className="text-sm text-red-300">{erro}</Msg>
      <div className="flex gap-2">
        <Botao tipo="primario" onClick={salvar}>Salvar</Botao>
        <Botao tipo="fantasma" onClick={fechar}>Cancelar</Botao>
      </div>
    </Cartao>
  )
}

export default function Maquinas({ nome }: { nome: string }) {
  const r = useMaquinas()
  const semInternet = useSemInternet()
  const [aberto, setAberto] = useState<Maquina | 'nova' | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const porLocal = useMemo(() => {
    const m = new Map<string, Maquina[]>()
    for (const x of r.lista) m.set(x.local, [...(m.get(x.local) ?? []), x])
    return [...m.entries()]
  }, [r.lista])
  const apagar = (m: Maquina) => {
    if (apagando !== m.id) return setApagando(m.id)
    apagarMaquina(m.id).catch((e) => {
      registrarErro('gravacao', `maquinas: ${e?.code ?? e}`, e)
      setMsg('Não deu para remover. Tente de novo.')
    })
    setApagando(null)
    setMsg(`Removida: ${m.nome}.`)
  }

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <BotaoVoltar para="/catalogo" />
      <h1 className="mb-1 text-lg font-bold">Máquinas</h1>
      <p className="mb-3 text-xs text-slate-400">Cada máquina com a escala dela, ligada aos exercícios.</p>
      {aberto ? (
        <Formulario key={aberto === 'nova' ? 'nova' : aberto.id} inicial={aberto === 'nova' ? null : aberto} existentes={r.lista} nome={nome} confirmado={!r.cache} fechar={() => setAberto(null)} aviso={setMsg} />
      ) : (
        <Botao tipo="primario" className="mb-3 w-full" onClick={() => (setAberto('nova'), setMsg(''))} disabled={r.carregando}>
          Adicionar máquina
        </Botao>
      )}
      <Msg className="mb-3 text-sm text-emerald-300">{msg}</Msg>
      {r.erro && <p className="mb-3 text-sm text-red-300">Não deu para carregar as máquinas.</p>}
      {semInternet && r.carregando && <p className="mb-3 text-sm text-slate-400">{TEXTO_SEM_INTERNET}</p>}
      {!r.carregando && !r.erro && r.lista.length === 0 && <p className="text-sm text-slate-400">Nenhuma máquina cadastrada ainda.</p>}

      {porLocal.map(([local, maquinas]) => (
        <section key={local} className="mb-4">
          <h2 className="mb-2 text-sm font-bold text-slate-300">{local} · {maquinas.length}</h2>
          <ul className="space-y-2">
            {maquinas.map((m) => (
              <li key={m.id}>
                <Cartao className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{m.nome}</p>
                      <p className="text-xs text-slate-400">
                        {[TIPOS_MAQUINA.find((t) => t.id === m.tipo)?.rotulo, m.fabricante, m.modelo].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-300">{resumoEscala(m)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {m.exercicios.length ? m.exercicios.map((id) => nomeDoExercicio(id) ?? 'Exercício removido').join(' · ') : 'Sem exercício ligado'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button type="button" onClick={() => (setAberto(m), setMsg(''), setApagando(null))} className="min-h-11 px-2 text-sm text-slate-300">Editar</button>
                      <button type="button" onClick={() => apagar(m)} className={`min-h-11 px-2 text-sm ${apagando === m.id ? 'font-semibold text-red-300' : 'text-slate-400'}`}>
                        {apagando === m.id ? 'Confirmar' : 'Remover'}
                      </button>
                    </div>
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
