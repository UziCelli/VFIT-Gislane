import { renderSVG } from 'uqr'

// Guarda os últimos gerados (27/11/2026): o Pix redesenha a cada toque (copiar, mostrar código) e o QR
// era refeito do zero, na linha principal, a cada vez. Poucos textos por tela; limite só por garantia.
const feitos = new Map<string, string>()
export function qrDataUrl(texto: string) {
  let url = feitos.get(texto)
  if (url == null) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderSVG(texto))}`
    if (feitos.size >= 8) feitos.delete(feitos.keys().next().value!)
    feitos.set(texto, url)
  }
  return url
}
