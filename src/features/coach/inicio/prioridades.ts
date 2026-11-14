import type { Usuario } from '../../../lib/acesso'
import { fimISO } from '../../../lib/relatorio'
import type { Meso } from '../../../engine'
import { semanaAtual } from '../../../lib/treino'
import { dataSP } from '../../aluno/mesoAtual'

type Ciclo = { id: string; alunoId: string; nome?: string; meso: Meso }
type Avaliacao = { alunoId: string; data: string }
type Sinal = { alunoId: string; motivo: string }

// Indícios para o coach conferir; não concluem que um treino precisa ser trocado.
export function prioridadesTreino(alunos: (Usuario & { id: string })[], ciclos: Ciclo[], avaliacoes: Avaliacao[], sinais: Sinal[], agora: Date) {
  const hoje = dataSP(agora)
  const emSeteDias = new Date(Date.parse(`${hoje}T12:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10)
  return alunos.filter((a) => a.status === 'ativo').flatMap((aluno) => {
    const lista = ciclos.filter((c) => c.alunoId === aluno.id).sort((a, b) => b.meso.inicio.localeCompare(a.meso.inicio))
    const atual = lista.find((c) => semanaAtual(c.meso, agora).estado === 'durante') ?? lista.find((c) => c.meso.inicio.slice(0, 10) <= hoje)
    const futuro = lista.some((c) => c.meso.inicio.slice(0, 10) > hoje && (!atual || c.meso.inicio.slice(0, 10) > atual.meso.inicio.slice(0, 10)))
    const motivos: string[] = []
    let ordem = 3
    if (!atual && !futuro) { motivos.push('Sem mesociclo cadastrado'); ordem = 0 }
    if (atual && !futuro && fimISO(atual.meso) < hoje) { motivos.push('Ciclo encerrado · montar o próximo'); ordem = 0 }
    else if (atual && !futuro && fimISO(atual.meso) <= emSeteDias) { motivos.push('Ciclo termina em breve · planejar o próximo'); ordem = 1 }
    const av = avaliacoes.filter((a) => a.alunoId === aluno.id && a.data <= hoje).sort((a, b) => b.data.localeCompare(a.data))[0]
    if (av) { motivos.push(`Avaliação recente em ${av.data.slice(8, 10)}/${av.data.slice(5, 7)} · conferir o treino`); ordem = Math.min(ordem, 2) }
    for (const sinal of sinais.filter((s) => s.alunoId === aluno.id)) if (!motivos.includes(sinal.motivo)) motivos.push(sinal.motivo)
    return motivos.length ? [{ alunoId: aluno.id, nome: aluno.nome, motivos, ordem }] : []
  }).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
}
