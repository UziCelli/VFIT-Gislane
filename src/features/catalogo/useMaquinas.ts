import { collection } from 'firebase/firestore'
import { useEffect, useMemo } from 'react'
import { darRefMaquina } from '../../lib/acoes'
import { db } from '../../lib/firebase'
import { registrarErro } from '../../lib/log'
import { useLista } from '../../lib/hooks'
import { deDoc, novaRef, type DocMaquina } from '../../lib/maquinas'

const tentadas = new Set<string>()

// Máquinas do coach (maquinas/{id}). Só o coach lê (regras): catálogo, montagem do treino e presencial.
// Cadastro antigo sem `ref` ganha uma identidade opaca na primeira leitura (uma tentativa por sessão do app); até lá
// não aparece no seletor do treino. O id antigo do documento continua, mas nunca vai para o treino.
export function useMaquinas() {
  const r = useLista<DocMaquina>(useMemo(() => collection(db, 'maquinas'), []))
  const lista = useMemo(() => r.dados.map(deDoc).sort((a, b) => a.local.localeCompare(b.local, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR')), [r.dados])
  useEffect(() => {
    for (const m of lista) {
      if (m.ref || tentadas.has(m.id)) continue
      tentadas.add(m.id)
      darRefMaquina(m.id, novaRef()).catch((e) => registrarErro('gravacao', `maquinas ref: ${e?.code ?? e}`, e))
    }
  }, [lista])
  return { ...r, lista }
}
