import { doc } from 'firebase/firestore'
import { useMemo, useState } from 'react'
import { diaSP, type Usuario } from '../../lib/acesso'
import { apagarAvaliacao, novaAvaliacaoId, recolherAvaliacao, salvarAvaliacao } from '../../lib/acoes'
import {
  BIO, cicloDaAvaliacao, DOBRAS, FAIXA, lerAvaliacao, LIPEDEMA, PERIMETROS, relatorioAvaliacao,
  efetiva, etmDoAluno, resultado, type Avaliacao as Av, type AvaliacaoForm, type Lipedema,
} from '../../lib/avaliacao'
import { linkEmail, linkWhatsApp, primeiroNome } from '../../lib/contato'
import { db } from '../../lib/firebase'
import { historicoExercicios } from '../../lib/evolucao'
import { useDoc } from '../../lib/hooks'
import { relatorioCiclo } from '../../lib/relatorio'
import { ir, trocarRota } from '../../rota'
import { Aviso, Botao, campoBase, Centro, flash } from '../../ui'
import { BotaoVoltar } from '../../voltar'
import { useDadosAluno } from '../relatorio/useDadosAluno'
import Avaliacao, { BotaoPdfAvaliacao } from './Avaliacao'
import { useAvaliacoesDoAluno } from './AvaliacoesCoach'
import OscilacoesCoach from './OscilacoesCoach'
import { EQUACOES, escolherEquacao, type EquacaoId } from '../../lib/equacoesDobras'
import { foraDaTolerancia, MIN_PARES, TOLERANCIA } from '../../lib/etm'
import { useDores } from '../fisio/useDores'

const botaoLink = 'grid min-h-11 flex-1 place-items-center rounded-lg bg-slate-800 px-3 py-2 text-center text-sm font-semibold text-slate-100 hover:bg-slate-700'
type Faixa = readonly [number, number]
type Textos = Record<string, string>

const num = (s: string | undefined) => {
  const t = (s ?? '').trim().replace(',', '.')
  return t === '' ? undefined : Number(t)
}
const fora = (s: string | undefined, [min, max]: Faixa) => {
  const x = num(s)
  return x !== undefined && !(x >= min && x <= max)
}
const txt = (x: number | undefined) => (x == null ? '' : String(x).replace('.', ','))
const hoje = () => new Date(diaSP(Date.now()) * 86_400_000).toISOString().slice(0, 10)

const Num = ({ rotulo, v, onChange, ruim }: { rotulo: string; v: string; onChange: (s: string) => void; ruim: boolean }) => (
  <label className="flex min-w-0 flex-col gap-1 text-sm">
    <span className="text-slate-400">{rotulo}</span>
    <input
      type="text"
      inputMode="decimal"
      value={v}
      aria-invalid={ruim}
      onChange={(e) => onChange(e.target.value)}
      className={`${ruim ? 'rounded-lg border border-red-500 bg-slate-950 text-base text-slate-100' : campoBase} min-h-11 w-full min-w-0 px-3 py-2 outline-none focus:border-marca-500`}
    />
  </label>
)

export default function AvaliacaoCoach({ uid, id: idRota }: { uid: string; id: string }) {
  const [idNovo] = useState(novaAvaliacaoId)
  const aluno = useDoc<Usuario>(useMemo(() => doc(db, 'usuarios', uid), [uid]))
  const criando = idRota === 'nova'
  const id = criando ? idNovo : idRota
  const atual = useDoc<object>(useMemo(() => (criando ? null : doc(db, 'avaliacoes', idRota)), [criando, idRota]))
  const outras = useAvaliacoesDoAluno(uid)
  const dados = useDadosAluno(uid)
  const ficha = atual.dados ? lerAvaliacao(id, atual.dados) : null
  const achou = criando || (!!ficha && ficha.alunoId === uid)
  return (
    <main className="mx-auto max-w-md px-4 py-4 lg:max-w-3xl">
      <BotaoVoltar para={`/aluno/${uid}/avaliacoes`} />
      {aluno.carregando || atual.carregando || outras.carregando || dados.carregando ? (
        <Centro>Carregando…</Centro>
      ) : !achou || !aluno.dados ? (
        <p className="py-6 text-center text-slate-400">Avaliação não encontrada.</p>
      ) : (
        <Editor uid={uid} id={id} aluno={aluno.dados} ficha={criando ? null : ficha} outras={outras.dados} dados={dados} />
      )}
    </main>
  )
}

function Editor({ uid, id, aluno, ficha, outras, dados }: { uid: string; id: string; aluno: Usuario; ficha: Av | null; outras: Av[]; dados: ReturnType<typeof useDadosAluno> }) {
  const cargas = useMemo(() => historicoExercicios(dados.mesos, dados.registros), [dados.mesos, dados.registros])
  const dores = useDores(uid)
  const base = ficha ?? outras[0] // nova: sexo, idade e altura vêm da avaliação mais recente
  const [v, setV] = useState<Textos>(() => ({
    data: ficha?.data ?? hoje(),
    sexo: base?.sexo ?? '',
    idade: txt(base?.idade),
    peso: ficha ? txt(ficha.pesoKg) : txt(aluno.pesoKg),
    altura: txt(base?.alturaCm),
    comentario: ficha?.comentario ?? '',
    ...Object.fromEntries([
      ...PERIMETROS.map((p) => ['p_' + p.id, txt(ficha?.perimetros[p.id])]),
      ...DOBRAS.map((d) => ['d_' + d.id, txt(ficha?.dobras[d.id])]),
      ...PERIMETROS.map((p) => ['p2_' + p.id, txt(ficha?.perimetros2?.[p.id])]),
      ...DOBRAS.map((d) => ['d2_' + d.id, txt(ficha?.dobras2?.[d.id])]),
      ...BIO.map((b) => ['b_' + b.id, txt(ficha?.bio[b.id])]),
    ]),
  }))
  const [lipedema, setLipedema] = useState<Lipedema[]>(base?.lipedema ?? [])
  // 2ª medida de cada ponto (ETM): ligada se a avaliação já tem alguma, ou se a anterior usou.
  const [duplo, setDuplo] = useState(() => !!(base?.dobras2 || base?.perimetros2))
  const [equacao, setEquacao] = useState<EquacaoId | ''>(ficha?.equacao ?? base?.equacao ?? '')
  const [existe, setExiste] = useState(!!ficha)
  const [liberado, setLiberado] = useState(!!ficha?.liberado)
  // Trocar a rota remonta a tela: a mensagem do 1º salvar atravessa pelo `flash`.
  const [msg, setMsg] = useState(() => {
    const t = flash.texto
    flash.texto = ''
    return t
  })
  const [apagando, setApagando] = useState(false)
  const set = (k: string) => (s: string) => setV((x) => ({ ...x, [k]: s }))

  const faixas: [string, Faixa][] = [
    ['peso', FAIXA.peso], ['altura', FAIXA.altura], ['idade', FAIXA.idade],
    ...PERIMETROS.map((p): [string, Faixa] => ['p_' + p.id, FAIXA.perimetro]),
    ...DOBRAS.map((d): [string, Faixa] => ['d_' + d.id, FAIXA.dobra]),
    ...PERIMETROS.map((p): [string, Faixa] => ['p2_' + p.id, FAIXA.perimetro]),
    ...DOBRAS.map((d): [string, Faixa] => ['d2_' + d.id, FAIXA.dobra]),
    ...BIO.map((b): [string, Faixa] => ['b_' + b.id, [0.1, b.max]]),
  ]
  const ruim = (k: string) => {
    const f = faixas.find(([n]) => n === k)
    return !!f && (fora(v[k], f[1]) || (k === 'idade' && num(v.idade) != null && !Number.isInteger(num(v.idade))))
  }
  const pega = <T extends readonly { id: string }[]>(pre: string, defs: T) =>
    Object.fromEntries(defs.flatMap((d) => (num(v[pre + d.id]) == null ? [] : [[d.id, num(v[pre + d.id])!]])))
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(v.data) && num(v.peso) != null && !faixas.some(([k]) => ruim(k))
  const form: AvaliacaoForm | null = valido
    ? {
        alunoId: uid,
        data: v.data,
        pesoKg: num(v.peso)!,
        alturaCm: num(v.altura),
        sexo: v.sexo === 'M' || v.sexo === 'F' ? v.sexo : undefined,
        idade: num(v.idade),
        perimetros: pega('p_', PERIMETROS),
        dobras: pega('d_', DOBRAS),
        ...(duplo && Object.keys(pega('p2_', PERIMETROS)).length ? { perimetros2: pega('p2_', PERIMETROS) } : {}),
        ...(duplo && Object.keys(pega('d2_', DOBRAS)).length ? { dobras2: pega('d2_', DOBRAS) } : {}),
        ...(equacao ? { equacao } : {}),
        bio: pega('b_', BIO),
        lipedema,
        comentario: v.comentario,
      }
    : null

  const cicloId = form ? cicloDaAvaliacao(dados.mesos, form.data) : null
  // Memo: sem ele, cada número digitado na ficha recalculava o ciclo inteiro.
  const ciclo = useMemo(() => (cicloId ? relatorioCiclo(dados.mesos, dados.registros, cicloId, new Date()) : null), [cicloId, dados.mesos, dados.registros])
  const r = form ? relatorioAvaliacao([...outras.filter((a) => a.id !== id), { ...form, id, liberado }], id, ciclo, cargas) : null

  // Não espera o servidor (offline a promessa só resolve na volta da internet): o estado vem do que o aparelho já sabe.
  const rodar = (p: Promise<void>, ok: string) => {
    setMsg(ok)
    p.catch(() => setMsg('Não foi possível salvar. Confira a internet e tente de novo.'))
  }
  const gravar = (lib: boolean, ok: string) => {
    if (!form) return
    rodar(salvarAvaliacao(id, form, lib), ok)
    setLiberado(lib)
    if (!existe) {
      setExiste(true)
      flash.texto = ok
      trocarRota(`/aluno/${uid}/avaliacao/${id}`)
    }
  }
  const aviso = `Oi, ${primeiroNome(aluno.nome)}! Sua avaliação física está pronta no app. Abra o Início para ver.`
  // `pre2`: prefixo da 2ª medida (com "Medir 2 vezes" ligado, cada ponto ocupa a linha: 1ª e 2ª lado a lado).
  const secao = (titulo: string, itens: { id: string; rotulo: string }[], pre: string, pre2?: string) => (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-semibold">{titulo}</legend>
      <div className="grid grid-cols-2 gap-3">
        {itens.map((i) =>
          duplo && pre2 ? (
            <div key={i.id} className="col-span-2 grid grid-cols-2 gap-3">
              <Num rotulo={`${i.rotulo} (1ª)`} v={v[pre + i.id]} onChange={set(pre + i.id)} ruim={ruim(pre + i.id)} />
              <Num rotulo="2ª medida" v={v[pre2 + i.id]} onChange={set(pre2 + i.id)} ruim={ruim(pre2 + i.id)} />
            </div>
          ) : (
            <Num key={i.id} rotulo={i.rotulo} v={v[pre + i.id]} onChange={set(pre + i.id)} ruim={ruim(pre + i.id)} />
          ),
        )}
      </div>
    </fieldset>
  )
  // Equação automática (o que o app escolheria sem a chave) e ETM do aluno com esta avaliação.
  const auto = form?.sexo && form.idade != null ? escolherEquacao({ sexo: form.sexo, idade: form.idade, dobras: efetiva({ ...form, id, liberado }).dobras, imc: resultado({ ...form, id, liberado }).imc }) : null
  const erro = form ? etmDoAluno([...outras.filter((a) => a.id !== id), { ...form, id, liberado }]) : null
  const refazer = form ? [
    ...foraDaTolerancia(form.dobras, form.dobras2, 'dobra').map((x) => ({ ...x, rotulo: DOBRAS.find((d) => d.id === x.id)!.rotulo, un: 'mm' })),
    ...foraDaTolerancia(form.perimetros, form.perimetros2, 'perimetro').map((x) => ({ ...x, rotulo: PERIMETROS.find((p) => p.id === x.id)!.rotulo, un: 'cm' })),
  ] : []

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h1 className="font-semibold">Avaliação física de {aluno.nome}</h1>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-slate-400">Data</span>
            <input type="date" value={v.data} onChange={(e) => set('data')(e.target.value)} className={`${campoBase} min-h-11 w-full min-w-0 px-3 py-2 outline-none focus:border-marca-500`} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            <span className="text-slate-400">Sexo</span>
            <select value={v.sexo} onChange={(e) => set('sexo')(e.target.value)} className={`${campoBase} min-h-11 w-full min-w-0 px-3 py-2 outline-none focus:border-marca-500`}>
              <option value="">Não informado</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </label>
          <Num rotulo="Idade" v={v.idade} onChange={set('idade')} ruim={ruim('idade')} />
          <Num rotulo="Peso (kg)" v={v.peso} onChange={set('peso')} ruim={ruim('peso')} />
          <Num rotulo="Altura (cm)" v={v.altura} onChange={set('altura')} ruim={ruim('altura')} />
        </div>
        <fieldset className="space-y-1">
          <legend className="sr-only">Lipedema</legend>
          {LIPEDEMA.map((l) => (
            <label key={l.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={lipedema.includes(l.id)}
                onChange={(e) => setLipedema((x) => (e.target.checked ? [...x, l.id] : x.filter((i) => i !== l.id)))}
                className="size-6 shrink-0 accent-marca-500"
              />
              {l.rotulo}
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={duplo} onChange={(e) => setDuplo(e.target.checked)} className="size-6 shrink-0 accent-marca-500" />
          Medir 2 vezes cada ponto (calcula o ETM; vale a média)
        </label>
        {secao('Perímetros (cm)', [...PERIMETROS], 'p_', 'p2_')}
        {secao('Dobras cutâneas (mm, lado direito)', [...DOBRAS], 'd_', 'd2_')}
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="text-slate-400">Equação do % de gordura</span>
          <select value={equacao} onChange={(e) => setEquacao(e.target.value as EquacaoId | '')} className={`${campoBase} min-h-11 w-full min-w-0 px-3 py-2 outline-none focus:border-marca-500`}>
            <option value="">Automática{auto ? `: ${EQUACOES[auto.eq].curto} (${auto.motivo})` : ''}</option>
            {(Object.keys(EQUACOES) as EquacaoId[]).map((k) => (
              <option key={k} value={k}>{EQUACOES[k].nome}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{EQUACOES[(equacao || auto?.eq || 'jp7') as EquacaoId].populacao}.</span>
        </label>
        {(refazer.length > 0 || erro?.dobra || erro?.perimetro) && (
          <div className="space-y-1 rounded-xl border border-slate-800 p-3 text-sm">
            <p className="font-semibold">Erro técnico de medição (ETM)</p>
            {([['Dobras', erro?.dobra, TOLERANCIA.dobra], ['Perímetros', erro?.perimetro, TOLERANCIA.perimetro]] as const).map(([nome, e, tol]) =>
              e ? (
                <p key={nome} className={e.dentro ? 'text-slate-300' : 'text-amber-300'}>
                  {nome}: {e.pct.toLocaleString('pt-BR')}% ({e.n} {e.n === 1 ? 'par' : 'pares'}; tolerância até {tol}%){e.n < MIN_PARES ? ' · ainda poucos pares para ajustar os limites' : ''}
                </p>
              ) : null,
            )}
            {refazer.map((x) => (
              <p key={x.id} className="text-amber-300">{x.rotulo}: {x.a} e {x.b} {x.un} ({x.pct}% de diferença). Meça a 3ª vez e use as 2 mais próximas.</p>
            ))}
          </div>
        )}
        {secao('Bioimpedância', BIO.map((b) => ({ id: b.id, rotulo: `${b.rotulo}${b.un ? ` (${b.un})` : ''}` })), 'b_')}
      </section>

      {r ? <Avaliacao r={r} aluno={aluno.nome} comentario={v.comentario} /> : <p className="text-sm text-slate-400">Preencha a data e o peso (dentro das faixas) para ver o resultado.</p>}
      {r && <OscilacoesCoach atual={r.atual} ant={outras.filter((a) => a.id !== id && a.data < r.atual.data).sort((a, b) => a.data.localeCompare(b.data)).at(-1) ?? null} todas={[...outras.filter((a) => a.id !== id), { ...form!, id, liberado }]} cargas={cargas} dores={dores.todos} />}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="block text-sm font-semibold" htmlFor="recado-avaliacao">Seu recado para o aluno</label>
        <textarea
          id="recado-avaliacao"
          value={v.comentario}
          maxLength={3000}
          rows={4}
          onChange={(e) => set('comentario')(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-marca-500"
        />
        {aluno.presencial ? (
          <>
            <p className="text-sm text-slate-400">Aluno sem app: envie o PDF.</p>
            <Botao tipo="primario" className="w-full" disabled={!form} onClick={() => gravar(false, 'Salvo.')}>Salvar</Botao>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">{liberado ? 'O aluno já está vendo esta avaliação.' : 'O aluno só vê depois que você liberar.'}</p>
            <div className="flex flex-wrap gap-2">
              {liberado ? (
                <>
                  <Botao tipo="primario" className="flex-1" disabled={!form} onClick={() => gravar(true, 'Avaliação atualizada.')}>Atualizar</Botao>
                  <Botao className="flex-1" onClick={() => { rodar(recolherAvaliacao(id), 'Avaliação recolhida: o aluno não vê mais.'); setLiberado(false) }}>Recolher</Botao>
                </>
              ) : (
                <>
                  <Botao className="flex-1" disabled={!form} onClick={() => gravar(false, 'Rascunho salvo.')}>Salvar rascunho</Botao>
                  <Botao tipo="primario" className="flex-1" disabled={!form} onClick={() => gravar(true, 'Liberada para o aluno.')}>Liberar para o aluno</Botao>
                </>
              )}
            </div>
          </>
        )}
        {msg && <p role="status" className="text-sm text-green-400">{msg}</p>}
        {liberado && !aluno.presencial && (
          <div className="flex flex-wrap gap-2">
            <a href={linkWhatsApp(aviso)} target="_blank" rel="noreferrer" className={botaoLink}>Avisar no WhatsApp</a>
            {aluno.email && <a href={linkEmail(aluno.email, 'Sua avaliação física', aviso)} className={botaoLink}>Avisar por e-mail</a>}
          </div>
        )}
        {r && <BotaoPdfAvaliacao r={r} aluno={aluno.nome} comentario={v.comentario} />}
        {existe &&
          (apagando ? (
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <Aviso>Tem certeza que quer apagar esta avaliação? Não dá para desfazer.</Aviso>
              <div className="flex flex-wrap gap-2">
                <Botao
                  tipo="perigo"
                  onClick={() => {
                    apagarAvaliacao(id).catch(() => setMsg('Não foi possível apagar. Confira a internet e tente de novo.'))
                    ir(`/aluno/${uid}/avaliacoes`)
                  }}
                >
                  Sim, apagar
                </Botao>
                <Botao onClick={() => setApagando(false)}>Cancelar</Botao>
              </div>
            </div>
          ) : (
            <Botao tipo="alerta" className="w-full" onClick={() => setApagando(true)}>Apagar avaliação</Botao>
          ))}
      </section>
    </div>
  )
}
