import marca from '@marca/marca.json'

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

// Foto em círculo; sem foto, iniciais sobre gradiente da marca. `selo`: ícone da marca no canto, como "verificado".
// `coroa`: coroa dourada "Voz do app" sobre a foto (prêmio por feedback, 30 dias).
export function Avatar({ img, nome, selo, coroa, tamanho }: { img?: string; nome: string; selo?: boolean; coroa?: boolean; tamanho: number }) {
  const s = Math.round(tamanho * 0.35)
  const c = Math.round(tamanho * 0.42)
  return (
    <span className="relative inline-block shrink-0" style={{ width: tamanho, height: tamanho }}>
      {coroa && (
        <svg role="img" aria-label="Coroa Voz do app" viewBox="0 0 24 24" className="absolute left-1/2 z-10 -translate-x-1/2 drop-shadow" style={{ width: c, height: c, top: -c * 0.62 }}>
          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="3" cy="8" r="1.6" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
          <circle cx="12" cy="5" r="1.6" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
          <circle cx="21" cy="8" r="1.6" fill="#fde68a" stroke="#b45309" strokeWidth="0.8" />
        </svg>
      )}
      {img ? (
        <img src={img} alt={`Foto de ${nome}`} className="size-full rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="grid size-full place-items-center rounded-full bg-gradient-to-br from-marca-500 to-marca-700 font-bold text-white"
          style={{ fontSize: tamanho * 0.4 }}
        >
          {iniciais(nome)}
        </span>
      )}
      {selo && (
        <img
          src="/icon.svg"
          alt={`Selo ${marca.nome}`}
          className="absolute -bottom-px -right-px rounded-full bg-slate-900 ring-2 ring-slate-900"
          style={{ width: s, height: s }}
        />
      )}
    </span>
  )
}
