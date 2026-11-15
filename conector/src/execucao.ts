// Cada chamada de ferramenta: troca o refreshToken do coach por um idToken novo e roda a leitura como ele.
import { chaveDoGoogle, verificarIdToken } from '../../push/src/jwt'
import { tokenAppCheck } from './appcheck'
import { ErroConector, Firestore, trocarToken, type Buscar } from './firestore'

export type Resposta = { content: { type: 'text'; text: string }[]; isError?: true }

export async function executar(
  cfg: { refreshToken: unknown; apiKey: string; projeto: string; buscar?: Buscar; appId?: string; debugToken?: string; uid?: string; obterChave?: (kid: string) => Promise<CryptoKey | null>; agora?: number },
  leitura: (fs: Firestore) => Promise<unknown>,
): Promise<Resposta> {
  try {
    if (typeof cfg.refreshToken !== 'string') throw new ErroConector('Conexão incompleta. Desconecte e conecte o assistente de novo.')
    const token = await trocarToken(cfg.refreshToken, cfg.apiKey, cfg.buscar)
    if (cfg.uid) {
      const quem = await verificarIdToken(token, cfg.obterChave ?? chaveDoGoogle, Math.floor((cfg.agora ?? Date.now()) / 1000), true)
      if (!quem || quem.uid !== cfg.uid || quem.projeto !== cfg.projeto) throw new ErroConector('Conexão inválida. Desconecte e conecte o assistente de novo com o código de 2 etapas.')
    }
    const appCheck = await tokenAppCheck(cfg)
    const dado = await leitura(new Firestore(cfg.projeto, token, cfg.buscar, appCheck))
    return { content: [{ type: 'text', text: JSON.stringify(dado) }] }
  } catch (e) {
    // Só mensagens nossas voltam ao Claude; erro desconhecido vira texto genérico (nunca token nem dado de aluno).
    return { isError: true, content: [{ type: 'text', text: e instanceof ErroConector ? e.message : 'Erro inesperado no conector.' }] }
  }
}
