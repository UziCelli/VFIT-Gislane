import { collection } from 'firebase/firestore'
import { useEffect, useMemo } from 'react'
import { deDoc, definirProprios, type DocProprio } from '../../lib/catalogoProprio'
import { db } from '../../lib/firebase'
import { useLista } from '../../lib/hooks'

// Exercícios cadastrados pelo coach (exerciciosProprios). Montado no app do coach: a busca da montagem do treino e
// as pílulas passam a enxergá-los. A tela do catálogo usa a mesma consulta (o Firestore junta, sem leitura extra).
export function useExerciciosProprios() {
  const r = useLista<DocProprio>(useMemo(() => collection(db, 'exerciciosProprios'), []))
  const lista = useMemo(() => r.dados.map(deDoc), [r.dados])
  useEffect(() => definirProprios(lista), [lista])
  return { ...r, lista }
}
