// Confere a mesma troca usada pelo Worker antes de alterar o segredo publicado.
import { pathToFileURL } from 'node:url'

export async function verificarAppCheck({ projeto, appId, apiKey, debugToken, referer = 'https://app.vfitcoachapp.com/' }, buscar = fetch) {
  if (![projeto, appId, apiKey, debugToken].every((v) => typeof v === 'string' && v.trim())) return false
  try {
    const resposta = await buscar(
      `https://firebaseappcheck.googleapis.com/v1/projects/${encodeURIComponent(projeto)}/apps/${encodeURIComponent(appId)}:exchangeDebugToken?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Referer: referer },
        body: JSON.stringify({ debugToken }),
        signal: AbortSignal.timeout(10_000),
      },
    )
    if (!resposta.ok) return false
    const corpo = await resposta.json()
    const segundos = typeof corpo?.ttl === 'string' && /^\d+(?:\.\d+)?s$/.test(corpo.ttl) ? Number(corpo.ttl.slice(0, -1)) : NaN
    return typeof corpo?.token === 'string' && corpo.token.length > 0 && Number.isFinite(segundos) && segundos > 0
  } catch {
    return false
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ok = await verificarAppCheck({
    projeto: process.env.FIREBASE_PROJECT_ID,
    appId: process.env.FIREBASE_APP_ID,
    apiKey: process.env.FIREBASE_API_KEY,
    debugToken: process.env.APPCHECK_DEBUG_TOKEN,
    // Domínio do app da marca (a chave web de cada projeto só aceita o seu).
    ...(process.env.APP_REFERER && { referer: process.env.APP_REFERER }),
  })
  if (!ok) {
    console.error('::error::Não foi possível validar o App Check. Confira o registro no Firebase e o segredo APPCHECK_DEBUG_TOKEN no GitHub; consulte docs/seguranca.md.')
    process.exitCode = 1
  }
}
