// Busca no catálogo de exercícios (combobox do coach). Função pura.
// Devolve o nome novo (gerado em src/data/catalogo.ts), mas também acha pelo nome antigo e pelos apelidos.
import { EXERCICIOS_ATIVOS, nomesConhecidos } from '../data/catalogo'
import { proprios, versaoProprios } from './catalogoProprio'

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

type Item = { nome: string; grupo: string; proprio?: true; ns: string[] }
const base: Item[] = EXERCICIOS_ATIVOS.map((e) => ({ nome: e.nome, grupo: e.grupo, ns: [e.nome, ...nomesConhecidos(e).filter((n) => n !== e.nome)].map(norm) }))
// Os cadastrados pelo coach entram depois do catálogo base (empate fica com o base). Refeito só quando a lista muda.
let cache = { v: -1, itens: base }
const itensAtuais = () => {
  if (cache.v !== versaoProprios()) cache = { v: versaoProprios(), itens: [...base, ...proprios().map((e) => ({ nome: e.nome, grupo: e.grupo, proprio: true as const, ns: [norm(e.nome)] }))] }
  return cache.itens
}

export function buscarExercicios(texto: string, limite = 8): { nome: string; grupo: string; proprio?: true }[] {
  const t = norm(texto).trim()
  const termos = t.split(/\s+/).filter(Boolean)
  if (!termos.length) return []
  const palavras = (n: string) => n.split(/\s+/)
  // 0 = nome começa com o texto · 1 = palavra começa com o termo (todos) · 2 = contém
  const nota = (n: string) => (n.startsWith(t) ? 0 : termos.every((x) => palavras(n).some((p) => p.startsWith(x))) ? 1 : 2)
  // Vale o melhor dos nomes conhecidos (o novo primeiro: empate fica com ele).
  return itensAtuais()
    .filter((i) => i.ns.some((n) => termos.every((x) => n.includes(x))))
    .map((i) => ({ i, k: Math.min(...i.ns.filter((n) => termos.every((x) => n.includes(x))).map(nota)) }))
    .sort((a, b) => a.k - b.k) // estável: mantém a ordem do catálogo dentro da mesma nota
    .slice(0, limite)
    .map(({ i }) => ({ nome: i.nome, grupo: i.grupo, ...(i.proprio ? { proprio: true as const } : {}) }))
}
