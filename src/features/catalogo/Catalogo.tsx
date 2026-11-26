import { useMemo, useState } from 'react'
import { EQUIPAMENTOS, EXERCICIOS_ATIVOS, type ConvencaoCarga, type Equipamento, type Lateralidade } from '../../data/catalogo'
import { apagarProprio, gravarProprio } from '../../lib/acoes'
import { norm } from '../../lib/busca'
import { cargaPadrao, GRUPOS, MAX_BASE, nomeDoProprio, validarProprio, type ExercicioProprio } from '../../lib/catalogoProprio'
import { TEXTO_SEM_INTERNET, useSemInternet } from '../../lib/hooks'
import { registrarErro } from '../../lib/log'
import { pilulasDosAtributos } from '../../lib/pilulas'
import { Botao, Campo, campoBase, Cartao, classesOpcao, Msg } from '../../ui'
import { BotaoVoltar } from '../../voltar'
import PilulasExercicio, { ListaPilulas } from './PilulasExercicio'
import { useExerciciosProprios } from './useProprios'

// Catálogo de exercícios (épico #255, etapa 4 #259), só coach: consultar o catálogo (nome novo, nome antigo, pílulas)
// e cadastrar exercícios próprios. O catálogo base não é editado aqui; o cadastro vale só para esta marca.
const PASSO = 60
const selecao = `${campoBase} min-h-11 w-full min-w-0 px-3 py-2 outline-none focus:border-marca-500`
const LADOS: { id: Lateralidade; rotulo: string }[] = [
  { id: 'bilateral', rotulo: 'Os dois juntos' },
  { id: 'unilateral', rotulo: 'Um lado' },
  { id: 'alternado', rotulo: 'Alternado' },
]
const CARGAS: { id: ConvencaoCarga; rotulo: string }[] = [
  { id: 'total', rotulo: 'Carga total' },
  { id: 'por_lado', rotulo: 'Por lado' },
]
const EQUIP = Object.entries(EQUIPAMENTOS) as [Equipamento, string][]

function Novo({ existentes, nome, confirmado, fechar, aviso }: { existentes: readonly ExercicioProprio[]; nome: string; confirmado: boolean; fechar: () => void; aviso: (t: string) => void }) {
  const [base, setBase] = useState('')
  const [grupo, setGrupo] = useState('')
  const [equipamento, setEquipamento] = useState<Equipamento | ''>('')
  const [sufixo, setSufixo] = useState(true)
  const [lateralidade, setLateralidade] = useState<Lateralidade>('bilateral')
  const [excentrico, setExcentrico] = useState(false)
  const [carga, setCarga] = useState<ConvencaoCarga>('total')
  const [erro, setErro] = useState('')
  const trocarEquip = (e: Equipamento | '') => {
    setEquipamento(e)
    if (e) setCarga(cargaPadrao(e))
  }
  const dados = equipamento ? { base, grupo, equipamento, sufixo, lateralidade, modo: excentrico ? (['excentrico'] as const) : [], carga } : null
  const previa = dados && base.trim().length >= 3 ? validarProprio({ ...dados, modo: [...dados.modo] }, existentes, nome) : null
  const salvar = () => {
    if (!confirmado) return setErro('Sem internet. Conecte-se para salvar.')
    if (!dados) return setErro('Escolha o equipamento.')
    const r = validarProprio({ ...dados, modo: [...dados.modo] }, existentes, nome)
    if ('erro' in r) return setErro(r.erro ?? '')
    gravarProprio(r.id, { ...r.dados }).catch((e) => {
      registrarErro('gravacao', `exerciciosProprios: ${e?.code ?? e}`, e)
      aviso('Não deu para salvar. Tente de novo.')
    })
    aviso(`Cadastrado: ${r.nome}`)
    fechar()
  }
  return (
    <Cartao className="mb-3 space-y-3 p-3">
      <p className="text-base font-bold">Adicionar exercício</p>
      <div>
        <Campo rotulo="Movimento" placeholder="Ex.: Supino Inclinado" maxLength={MAX_BASE} value={base} onChange={(e) => (setBase(e.target.value), setErro(''))} />
        <p className="mt-1 text-xs text-slate-400">Sem o equipamento: ele entra no fim do nome sozinho.</p>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-400">Grupo muscular</span>
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className={selecao}>
          <option value="">Escolha…</option>
          {GRUPOS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-400">Equipamento</span>
        <select value={equipamento} onChange={(e) => trocarEquip(e.target.value as Equipamento | '')} className={selecao}>
          <option value="">Escolha…</option>
          {EQUIP.map(([id, r]) => <option key={id} value={id}>{r}</option>)}
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={!sufixo} onChange={(e) => setSufixo(!e.target.checked)} className="size-5 accent-marca-500" />
        Máquina com nome próprio (não repetir o equipamento no nome)
      </label>
      <div role="radiogroup" aria-label="Lados" className="grid grid-cols-3 gap-2">
        {LADOS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={lateralidade === l.id} onClick={() => setLateralidade(l.id)} className={classesOpcao(lateralidade === l.id, 'min-h-11 rounded-xl text-sm')}>
            {l.rotulo}
          </button>
        ))}
      </div>
      {equipamento && equipamento !== 'peso_do_corpo' && (
        <div role="radiogroup" aria-label="Como a carga é anotada" className="grid grid-cols-2 gap-2">
          {CARGAS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={carga === c.id} onClick={() => setCarga(c.id)} className={classesOpcao(carga === c.id, 'min-h-11 rounded-xl text-sm')}>
              {c.rotulo}
            </button>
          ))}
        </div>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={excentrico} onChange={(e) => setExcentrico(e.target.checked)} className="size-5 accent-marca-500" />
        Excêntrico
      </label>
      {dados && base.trim() && (
        <div className="rounded-xl border border-slate-700 p-3">
          <p className="text-xs text-slate-400">Nome no treino</p>
          <p className="text-base font-semibold">{nomeDoProprio(dados)}</p>
          <ListaPilulas pilulas={pilulasDosAtributos(dados)} className="mt-1.5" />
          {previa && 'erro' in previa && <p className="mt-2 text-sm text-amber-300">{previa.erro}</p>}
        </div>
      )}
      <Msg className="text-sm text-red-300">{erro}</Msg>
      <div className="flex gap-2">
        <Botao tipo="primario" onClick={salvar}>Salvar</Botao>
        <Botao tipo="fantasma" onClick={fechar}>Cancelar</Botao>
      </div>
    </Cartao>
  )
}

type Linha = { id: string; nome: string; grupo: string; equipamento: Equipamento | null; antigo?: string; proprio?: ExercicioProprio; ns: string[] }

export default function Catalogo({ nome }: { nome: string }) {
  const r = useExerciciosProprios()
  const semInternet = useSemInternet()
  const [novo, setNovo] = useState(false)
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [equip, setEquip] = useState<Equipamento | ''>('')
  const [limite, setLimite] = useState(PASSO)
  const [apagando, setApagando] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const linhas = useMemo<Linha[]>(
    () => [
      ...r.lista.map((p) => ({ id: p.id, nome: p.nome, grupo: p.grupo, equipamento: p.equipamento, proprio: p, ns: [norm(p.nome)] })),
      ...EXERCICIOS_ATIVOS.map((e) => ({
        id: e.id, nome: e.nome, grupo: e.grupo, equipamento: e.equipamento,
        ...(e.nomeCatalogo !== e.nome ? { antigo: e.nomeCatalogo } : {}),
        ns: [e.nome, e.nomeCatalogo, ...e.apelidos].map(norm),
      })),
    ],
    [r.lista],
  )
  const termos = norm(busca).trim().split(/\s+/).filter(Boolean)
  const lista = linhas.filter((l) => (!grupo || l.grupo === grupo) && (!equip || l.equipamento === equip) && (!termos.length || l.ns.some((n) => termos.every((t) => n.includes(t)))))
  const filtro = (f: () => void) => (f(), setLimite(PASSO))
  const apagar = (p: ExercicioProprio) => {
    if (apagando !== p.id) return setApagando(p.id)
    apagarProprio(p.id).catch((e) => {
      registrarErro('gravacao', `exerciciosProprios: ${e?.code ?? e}`, e)
      setMsg('Não deu para remover. Tente de novo.')
    })
    setApagando(null)
    setMsg(`Removido: ${p.nome}. Treinos que já usam continuam iguais.`)
  }

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <BotaoVoltar para="/videos" />
      <h1 className="mb-1 text-lg font-bold">Catálogo de exercícios</h1>
      <p className="mb-3 text-xs text-slate-400">
        {EXERCICIOS_ATIVOS.length} do catálogo · {r.lista.length} cadastrados por você
      </p>
      {novo ? (
        <Novo existentes={r.lista} nome={nome} confirmado={!r.cache} fechar={() => setNovo(false)} aviso={setMsg} />
      ) : (
        <Botao tipo="primario" className="mb-3 w-full" onClick={() => (setNovo(true), setMsg(''))} disabled={r.carregando}>
          Adicionar exercício
        </Botao>
      )}
      <Msg className="mb-3 text-sm text-emerald-300">{msg}</Msg>
      {r.erro && <p className="mb-3 text-sm text-red-300">Não deu para carregar os seus exercícios.</p>}
      {semInternet && r.carregando && <p className="mb-3 text-sm text-slate-400">{TEXTO_SEM_INTERNET}</p>}

      <Campo rotulo="Buscar (nome novo ou antigo)" type="search" value={busca} onChange={(e) => filtro(() => setBusca(e.target.value))} className="mb-2" />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select aria-label="Grupo" value={grupo} onChange={(e) => filtro(() => setGrupo(e.target.value))} className={selecao}>
          <option value="">Todos os grupos</option>
          {GRUPOS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select aria-label="Equipamento" value={equip} onChange={(e) => filtro(() => setEquip(e.target.value as Equipamento | ''))} className={selecao}>
          <option value="">Todo equipamento</option>
          {EQUIP.map(([id, rot]) => <option key={id} value={id}>{rot}</option>)}
        </select>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum exercício com esse filtro.</p>
      ) : (
        <ul className="space-y-2">
          {lista.slice(0, limite).map((l) => (
            <li key={l.id}>
              <Cartao className="p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {l.nome}
                      {l.proprio && <span className="ml-2 rounded-full bg-marca-600 px-2 py-0.5 text-[11px] font-bold text-white">Seu</span>}
                    </p>
                    <p className="text-xs text-slate-400">
                      {l.grupo}
                      {l.antigo ? ` · antes: ${l.antigo}` : ''}
                    </p>
                    <PilulasExercicio nome={l.nome} className="mt-1.5" />
                  </div>
                  {l.proprio && (
                    <button type="button" onClick={() => apagar(l.proprio!)} className={`min-h-11 shrink-0 px-2 text-sm ${apagando === l.id ? 'font-semibold text-red-300' : 'text-slate-400'}`}>
                      {apagando === l.id ? 'Confirmar' : 'Remover'}
                    </button>
                  )}
                </div>
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
    </main>
  )
}
