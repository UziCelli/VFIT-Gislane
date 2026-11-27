import { collection } from 'firebase/firestore'
import { useMemo } from 'react'
import { db } from '../../lib/firebase'
import { useLista } from '../../lib/hooks'
import { deDoc, type DocMaquina } from '../../lib/maquinas'

// Máquinas do coach (maquinas/{id}). Só lido nas telas do catálogo: o resto do app ainda não usa (etapas 6 e 7).
export function useMaquinas() {
  const r = useLista<DocMaquina>(useMemo(() => collection(db, 'maquinas'), []))
  const lista = useMemo(() => r.dados.map(deDoc).sort((a, b) => a.local.localeCompare(b.local, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')), [r.dados])
  return { ...r, lista }
}
