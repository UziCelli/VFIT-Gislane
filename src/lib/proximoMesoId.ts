// ID fixo por ciclo de origem, sem crescer a cada cópia do ciclo anterior.
export async function proximoMesoId(origemId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(origemId))
  return `proximo_${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`
}
