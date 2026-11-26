// Seletor "Treino | Físio | Referências | Vídeos" no topo da aba Guias do coach.
// Fica montado entre as quatro rotas (GuiasCoach): a pílula desliza até a aba tocada só com transição CSS de transform
// (roda na GPU, sem medir layout; ver a nota da Bolha em vidro.tsx).
export type Guia = 'treino' | 'fisio' | 'referencias' | 'videos'
const ABAS: { id: Guia; href: string; rotulo: string }[] = [
  { id: 'treino', href: '#/metodos', rotulo: 'Treino' },
  { id: 'fisio', href: '#/fisio', rotulo: 'Físio' },
  { id: 'referencias', href: '#/referencias', rotulo: 'Referências' },
  { id: 'videos', href: '#/videos', rotulo: 'Vídeos' },
]

export default function SeletorGuia({ ativo }: { ativo: Guia }) {
  const i = ABAS.findIndex((a) => a.id === ativo)
  return (
    <nav aria-label="Tipo de guia" className="relative mb-3 grid grid-cols-4 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
      {/* Largura de 1 aba: (interno − 3 vãos de 0,25rem) / 4; cada passo = 1 largura + 1 vão. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-1.25rem)/4)] rounded-lg bg-marca-600 transition-transform duration-[550ms] ease-[var(--mola-suave)] motion-reduce:transition-none"
        style={{ transform: `translateX(calc(${i} * (100% + 0.25rem)))` }}
      />
      {ABAS.map((a) => (
        <a
          key={a.id}
          href={a.href}
          aria-current={a.id === ativo ? 'page' : undefined}
          className={`relative flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-300 ${a.id === ativo ? 'text-white' : 'text-slate-300'}`}
        >
          {a.rotulo}
        </a>
      ))}
    </nav>
  )
}
