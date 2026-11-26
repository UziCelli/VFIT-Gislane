// Busca no catálogo de exercícios (combobox do coach). Função pura.
// Devolve o nome novo (gerado em src/data/catalogo.ts), mas também acha pelo nome antigo e pelos apelidos.
import { EXERCICIOS, nomesConhecidos } from '../data/catalogo'

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const itens = EXERCICIOS.map((e) => ({ nome: e.nome, grupo: e.grupo, ns: [e.nome, ...nomesConhecidos(e).filter((n) => n !== e.nome)].map(norm) }))

export function buscarExercicios(texto: string, limite = 8): { nome: string; grupo: string }[] {
  const t = norm(texto).trim()
  const termos = t.split(/\s+/).filter(Boolean)
  if (!termos.length) return []
  const palavras = (n: string) => n.split(/\s+/)
  // 0 = nome começa com o texto · 1 = palavra começa com o termo (todos) · 2 = contém
  const nota = (n: string) => (n.startsWith(t) ? 0 : termos.every((x) => palavras(n).some((p) => p.startsWith(x))) ? 1 : 2)
  // Vale o melhor dos nomes conhecidos (o novo primeiro: empate fica com ele).
  return itens
    .filter((i) => i.ns.some((n) => termos.every((x) => n.includes(x))))
    .map((i) => ({ i, k: Math.min(...i.ns.filter((n) => termos.every((x) => n.includes(x))).map(nota)) }))
    .sort((a, b) => a.k - b.k) // estável: mantém a ordem do catálogo dentro da mesma nota
    .slice(0, limite)
    .map(({ i }) => ({ nome: i.nome, grupo: i.grupo }))
}
