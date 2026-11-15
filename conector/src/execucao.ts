// Cada chamada de ferramenta: troca o refreshToken do coach por um idToken novo e roda a leitura como ele.
import { ErroConector, Firestore, trocarToken, type Buscar } from './firestore'

export type Resposta = { content: { type: 'text'; text: string }[]; isError?: true }

export async function executar(
  cfg: { refreshToken: unknown; apiKey: string; projeto: string; buscar?: Buscar },
  leitura: (fs: Firestore) => Promise<unknown>,
): Promise<Resposta> {
  try {
    if (typeof cfg.refreshToken !== 'string') throw new ErroConector('Conexão incompleta. Desconecte e conecte o assistente de novo.')
    const token = await trocarToken(cfg.refreshToken, cfg.apiKey, cfg.buscar)
    const dado = await leitura(new Firestore(cfg.projeto, token, cfg.buscar))
    return { content: [{ type: 'text', text: JSON.stringify(dado) }] }
  } catch (e) {
    // Só mensagens nossas voltam ao Claude; erro desconhecido vira texto genérico (nunca token nem dado de aluno).
    return { isError: true, content: [{ type: 'text', text: e instanceof ErroConector ? e.message : 'Erro inesperado no conector.' }] }
  }
}
