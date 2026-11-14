// Limita bytes antes de manter o pedido completo em memória; Content-Length não é confiável.
export async function lerCorpoJson(req: Request, maxBytes: number): Promise<{ corpo: unknown; status?: never } | { status: 400 | 413 }> {
  const reader = req.body?.getReader()
  const chunks: Uint8Array[] = []
  let tamanho = 0
  try {
    if (reader) {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        tamanho += value.byteLength
        if (tamanho > maxBytes) {
          await reader.cancel()
          return { status: 413 }
        }
        chunks.push(value)
      }
    }
    const bytes = new Uint8Array(tamanho)
    let inicio = 0
    for (const chunk of chunks) { bytes.set(chunk, inicio); inicio += chunk.byteLength }
    return { corpo: JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)) }
  } catch {
    return { status: 400 }
  } finally {
    reader?.releaseLock()
  }
}
