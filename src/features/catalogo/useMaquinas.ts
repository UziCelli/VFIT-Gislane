import { collection } from 'firebase/firestore'
import { useMemo } from 'react'
import { db } from '../../lib/firebase'
import { useLista } from '../../lib/hooks'
import { deDoc, type DocMaquina } from '../../lib/maquinas'

// Máquinas do coach (maquinas/{id}). Só o coach lê (regras): catálogo, montagem do treino e presencial. Só leitura:
// cadastro antigo sem `ref` continua como está até o coach salvá-lo ou escolhê-lo para um treino (SeletorMaquina).
export function useMaquinas() {
  const r = useLista<DocMaquina>(useMemo(() => collection(db, 'maquinas'), []))
  const lista = useMemo(() => r.dados.map(deDoc).sort((a, b) => a.local.localeCompare(b.local, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')), [r.dados])
  return { ...r, lista }
}
