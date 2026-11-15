import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { executar } from './execucao'
import { catalogoExercicios, listarAlunos, verAluno, verMesos } from './ferramentas'

type Rodar = (leitura: Parameters<typeof executar>[1]) => ReturnType<typeof executar>

export function criarServidor(rodar: Rodar) {
  const s = new McpServer({ name: 'vfit-conector', version: '1.0.0' })
  const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true }
  const alunoId = z.string().describe('id do aluno (vem de listar_alunos)')
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
      description: 'Mesos do aluno (atual, próximo e anteriores): treinos, exercícios, séries e reps prescritas por semana e as cargas × reps que o aluno registrou.',
      inputSchema: z.object({ alunoId, mesoId: z.string().optional().describe('só este meso (opcional)') }),
    },
    ({ alunoId, mesoId }) => rodar((fs) => verMesos(fs, alunoId, mesoId)),
  )
  s.registerTool('catalogo_exercicios', { annotations, description: 'Nomes dos exercícios do catálogo (use exatamente estes) e os métodos disponíveis.' }, () => rodar(async () => catalogoExercicios()))
  return s
}
