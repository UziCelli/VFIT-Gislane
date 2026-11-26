import GuiaFisio from '../fisio/GuiaFisio'
import { Tela } from '../../ui'
import { BotaoVoltar } from '../../voltar'
import GuiaMetodos from './GuiaMetodos'
import GuiaReferencias from './GuiaReferencias'
import Videos from '../videos/Videos'
import SeletorGuia, { type Guia } from './SeletorGuia'

// Aba Guias do coach (/metodos, /fisio, /referencias, /videos). O Voltar e o seletor ficam montados entre as quatro: a pílula
// desliza até a aba tocada e só o conteúdo embaixo desliza para o mesmo lado (Tela com `lado`).
// `dentro`: a entrada na aba já anima a tela inteira (Tela do App); o conteúdo não faz um 2º fade por cima.
// -mx-4 + px-4: o corte do deslize fica na borda da tela, não no recuo dos cartões.
export const ROTAS_GUIA: Record<string, Guia | undefined> = { '/metodos': 'treino', '/fisio': 'fisio', '/referencias': 'referencias', '/videos': 'videos' }
const LADO: Record<Guia, number> = { treino: 0, fisio: 1, referencias: 2, videos: 3 }

export default function GuiasCoach({ guia, nome }: { guia: Guia; nome: string }) {
  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <BotaoVoltar para="/" />
      <SeletorGuia ativo={guia} />
      <div className="-mx-4">
        <Tela chave={guia} lado={LADO[guia]} dentro>
          <div className="px-4">
            {guia === 'treino' ? <GuiaMetodos coach /> : guia === 'fisio' ? <GuiaFisio /> : guia === 'referencias' ? <GuiaReferencias /> : <Videos nome={nome} />}
          </div>
        </Tela>
      </div>
    </main>
  )
}
