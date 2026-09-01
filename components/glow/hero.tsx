import Link from 'next/link'
import { ArrowDownToLine, Check, ShieldCheck } from 'lucide-react'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(circle_at_20%_10%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_42%),radial-gradient(circle_at_85%_20%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_35%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_0.8fr] lg:gap-20">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"><span className="size-1.5 rounded-full bg-accent" />The little app with a big feeling</p>
          <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.06em] sm:text-7xl lg:text-8xl">Make space for your <span className="glow-text">bright side.</span></h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Glow is a softer, simpler way to build daily rituals that keep you moving toward the life you want.</p>
          <div id="download" className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link href="/downloads/glow.apk" className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-accent px-7 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowDownToLine className="w-5 h-5" aria-hidden="true" />Download APK</Link>
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-accent" />Free · Android 8.0+</span>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Glow benefits"><li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" />No account needed</li><li className="flex items-center gap-2"><Check className="w-4 h-4 text-accent" />Private by default</li></ul>
        </div>
        <div className="mx-auto w-full max-w-sm rounded-[2.5rem] bg-gradient-to-br from-primary via-primary to-accent p-2 shadow-2xl shadow-primary/20 rotate-2">
          <div className="overflow-hidden rounded-[2.1rem] bg-foreground p-2"><img src="/placeholder.svg?height=720&width=360" alt="Glow app preview showing a daily reflection" className="aspect-[9/16] w-full rounded-[1.7rem] object-cover" /></div>
        </div>
      </div>
    </section>
  )
}

export default Hero
