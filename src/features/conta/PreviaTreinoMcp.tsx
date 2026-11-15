import { isometrico, metodosDaSessao, prescreverSessao, type AplicacaoMetodo } from '../../engine'
import { docParaMeso, type MesoDoc } from '../../lib/conversores'
import { fimISO } from '../../lib/relatorio'

const data = (s: string) => s.slice(0, 10).split('-').reverse().join('/')
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function detalheMetodo(m: AplicacaoMetodo) {
  return [m.metodo, m.escopo, m.serie != null && `série ${m.serie}`, m.grupo != null && `grupo ${m.grupo}`,
    m.reducaoCarga != null && `redução de carga ${m.reducaoCarga}%`, m.pausaInternaS != null && `pausa interna ${m.pausaInternaS} s`,
    m.blocos != null && `${m.blocos} blocos`, m.repsPorBloco != null && `${m.repsPorBloco} reps por bloco`,
    m.adicional != null && `${m.adicional} reps adicionais`, m.etapas != null && `${m.etapas} etapas`,
    m.repsPadrao != null && `${m.repsPadrao} reps padrão`, m.repsEtapa?.length && `reps por etapa: ${m.repsEtapa.map((v) => v ?? '—').join(', ')}`,
    m.cargaEtapa?.length && `carga por etapa: ${m.cargaEtapa.map((v) => v == null ? '—' : `${v} kg`).join(', ')}`].filter(Boolean).join(' · ')
}

export function PreviaTreinoMcp({ dados }: { dados: MesoDoc }) {
  const meso = docParaMeso(dados)
  return <div className="space-y-3 text-sm text-slate-200">
    <p>{meso.frequencia} treinos por semana · {meso.semanas} semanas · {data(meso.inicio)} a {data(fimISO(meso))}</p>
    <p>{meso.dias?.length ? `Dias: ${meso.dias.map((d) => DIAS[d]).join(', ')}` : 'Dias livres: o app sugere o próximo treino.'}</p>
    <p>Pausa padrão: {meso.pausaS} s{meso.pausaPrincipaisS != null && ` · Pausa dos principais: ${meso.pausaPrincipaisS} s`}</p>
    {meso.progressaoPct != null && <p>Progressão de volume: {meso.progressaoPct}% por semana</p>}
    {meso.limiteReps != null && <p>Limite: {meso.limiteReps} repetições por série</p>}
    {meso.tempoLimiteMin != null && <p>Aviso de duração: {meso.tempoLimiteMin} minutos</p>}
    {Array.from({ length: meso.semanas }, (_, i) => i + 1).map((semana) => <details key={semana} className="rounded-xl border border-slate-600 p-3" open={semana === 1}>
      <summary className="cursor-pointer font-semibold">Semana {semana}</summary>
      {Array.from({ length: meso.frequencia }, (_, i) => i + 1).map((treino) => {
        const sessao = prescreverSessao(meso, semana, treino)!
        const metodos = metodosDaSessao(meso, semana, treino).filter((m) => m.ativo)
        return <section key={treino} className="mt-3 space-y-2">
          <h3 className="font-semibold">Treino {treino}{meso.dias?.[treino - 1] != null && ` · ${DIAS[meso.dias[treino - 1]]}`}</h3>
          {sessao.exercicios.length === 0 && <p>Sem exercícios.</p>}
          <ol className="list-decimal space-y-3 pl-5">{sessao.exercicios.map((ex) => <li key={`${ex.pos}-${ex.slot.slotId}`}>
            <strong>{ex.slot.nome}</strong>{ex.slot.doisLados != null && ` · ${ex.slot.doisLados ? 'carga por lado' : 'carga total'}`}
            <p>{ex.reps.slice(0, ex.n).map((r, i) => `S${i + 1}: ${r} ${isometrico(ex.slot) ? 's' : 'reps'}`).join(' · ') || 'Sem séries'} · Pausa: {ex.pausaS} s</p>
            {metodos.filter((m) => m.exercicio === ex.pos).map((m, i) => <p key={i}>{detalheMetodo(m)}</p>)}
            {ex.drops.map((drop, i) => <p key={i}>Série {drop.serie}, etapa {drop.etapa}: {ex.reps[ex.n + i]} reps{ex.cargaSugerida[ex.n + i] != null && ` · ${ex.cargaSugerida[ex.n + i]} kg`}</p>)}
          </li>)}</ol>
        </section>
      })}
    </details>)}
  </div>
}
