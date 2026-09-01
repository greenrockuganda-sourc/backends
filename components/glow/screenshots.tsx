const shots = [
  { src: '/placeholder.svg?height=720&width=360', alt: 'Glow daily check-in screen' },
  { src: '/placeholder.svg?height=720&width=360', alt: 'Glow reflection prompt screen' },
  { src: '/placeholder.svg?height=720&width=360', alt: 'Glow progress screen' },
]

export function Screenshots() {
  return <section id="screenshots" className="overflow-hidden px-5 py-20 lg:px-8"><div className="mx-auto max-w-6xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">A calmer interface</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">A little light, <span className="text-muted-foreground">every day.</span></h2></div><p className="max-w-xs text-sm leading-6 text-muted-foreground">Thoughtful tools that get out of your way and back into your hands.</p></div><div className="mt-12 grid gap-5 sm:grid-cols-3">{shots.map((shot, index) => <figure key={shot.alt} className="rounded-[2rem] border border-border bg-card p-2"><img src={shot.src} alt={shot.alt} className="aspect-[9/16] w-full rounded-[1.5rem] object-cover" /><figcaption className="px-3 py-3 text-xs text-muted-foreground">0{index + 1} / Glow preview</figcaption></figure>)}</div></div></section>
}

export default Screenshots
