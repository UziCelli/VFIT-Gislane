import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { executar } from './execucao'
import { entradaPrescricaoSchema, type EntradaPrescricao } from './prescricao'
import type { Resposta } from './execucao'
import { statusDeConexao } from './statusConexao'
import { catalogoExercicios, listarAlunos, verAluno, verMesos } from './ferramentas'

type Rodar = (leitura: Parameters<typeof executar>[1]) => ReturnType<typeof executar>

export function criarServidor(rodar: Rodar, propostas?: { preparar: (entrada: EntradaPrescricao) => Promise<Resposta>; consultar: (id: string) => Promise<Resposta> }, diagnostico: () => unknown = () => undefined, verificar?: () => Promise<Resposta>) {
  const s = new McpServer({ name: 'vfit-conector', version: '2.0.0' }, { instructions: 'Consulte verificar_conexao e ver_mesos antes de editar. Identifique exercícios por slotId; prefira alteracoes para pedidos pontuais. Cada lote é integral e requer confirmação no app. Sessões registradas e ajustes presenciais são preservados. Uma proposta não é um treino salvo. Em resultado pendente, consulte antes de preparar outra proposta.' })
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
  const alunoId = z.string().describe('id do aluno (vem de listar_alunos)')
  s.registerTool('verificar_conexao', { annotations, description: 'Verifica autorização e dependências reais do conector antes de preparar propostas.' }, verificar ?? (async () => ({ content: [{ type: 'text' as const, text: JSON.stringify(statusDeConexao(diagnostico())) }] })))
  s.registerTool('listar_alunos', { annotations, description: 'Lista os alunos: nome, status, pago até, meso atual (semana e fim) e se já tem próximo meso.' }, () => rodar((fs) => listarAlunos(fs)))
  s.registerTool(
    'ver_aluno',
    { annotations, description: 'Perfil do aluno, anamnese mais recente (com sinais de atenção), última avaliação física, notas por exercício, relatos de dor e check-ins de recuperação.', inputSchema: z.object({ alunoId }) },
    ({ alunoId }) => rodar((fs) => verAluno(fs, alunoId)),
  )
  s.registerTool(
    'ver_mesos',
    {
      annotations,
      description: 'Mesos do aluno (atual, próximo e anteriores): treinos, exercícios, séries e reps prescritas por semana e as cargas × reps que o aluno registrou. Para remover exercícios, use os slotId da divisaoPlanejada, não os exercícios de sessões ajustadas.',
      inputSchema: z.object({ alunoId, mesoId: z.string().optional().describe('só este meso (opcional)'), incluirPrescricao: z.boolean().optional().describe('Retorna configuração completa e versão; exige mesoId.') }),
    },
    ({ alunoId, mesoId, incluirPrescricao }) => rodar((fs) => verMesos(fs, alunoId, mesoId, new Date(), incluirPrescricao)),
  )
  s.registerTool('catalogo_exercicios', { annotations, description: 'Nomes dos exercícios do catálogo (use exatamente estes) e os métodos disponíveis.' }, () => rodar(async () => catalogoExercicios()))
  if (propostas) {
    s.registerTool('preparar_treino', {
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      description: 'Prepara criação, próximo ciclo ou edição por alteracoes: adicionar, substituir, remover, mover, prescricao, metodo e configurar. Use slotId e versao de ver_mesos; novos exercícios podem usar referencia local no lote. Não combine alteracoes com meso ou removerSlotIds. Sessões registradas e presenciais são preservadas. Nenhum treino é salvo até o coach revisar e confirmar no app.',
      inputSchema: entradaPrescricaoSchema,
    }, (entrada) => propostas.preparar(entrada))
    s.registerTool('consultar_proposta', {
      annotations, description: 'Consulta o estado de uma proposta criada por esta conta.',
      inputSchema: z.object({ id: z.string().uuid() }).strict(),
    }, ({ id }) => propostas.consultar(id))
  }
  return s
}
