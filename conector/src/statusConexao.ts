// Resposta sem credenciais: o assistente só precisa saber o que pode solicitar.
export function statusDeConexao(props: unknown) {
  const p = props && typeof props === 'object' && !Array.isArray(props) ? props as Record<string, unknown> : {}
  const refreshValido = typeof p.refreshToken === 'string' && p.refreshToken.length > 0
  const uidValido = typeof p.uid === 'string' && p.uid.length > 0
  const estado = !refreshValido || (p.writeApproved === true && !uidValido) || (p.writeApproved !== undefined && typeof p.writeApproved !== 'boolean')
    ? 'incompleta' : p.writeApproved === true ? 'aprovada' : 'somente_leitura'
  return {
    versaoConector: 'prescricao-v2',
    autorizacaoTreinos: estado,
    podePrepararTreinos: estado === 'aprovada',
    confirmacaoNoApp: true,
    orientacao: estado === 'aprovada' ? 'O assistente pode preparar propostas; cada treino precisa ser conferido e confirmado no app.'
      : estado === 'somente_leitura' ? 'Esta conexão permite apenas leitura. Reconecte e confira a autorização para preparar treinos.'
      : 'A conexão está incompleta. Reconecte e confira as permissões no app.',
  }
}
