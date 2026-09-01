import { Brain, Heart, SunMedium } from 'lucide-react'

const features = [
  { icon: SunMedium, title: 'Start lighter', text: 'A tiny morning ritual to set an intention before the day gets loud.' },
  { icon: Heart, title: 'Keep it honest', text: 'Check in with yourself through prompts that feel human, not clinical.' },
  { icon: Brain, title: 'Notice the good', text: 'See patterns in your mood and celebrate progress without the pressure.' },
]

export function Features() {
  return <section id="features" className="border-y border-border bg-card/60 px-5 py-20 lg:px-8"><div className="mx-auto max-w-6xl"><div className="max-w-xl"><p className="eyebrow">Designed for real life</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Small moments. <span className="text-muted-foreground">Meaningful shifts.</span></h2></div><div className="mt-12 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-border bg-background p-6 transition-colors hover:border-primary/40"><div className="mb-12 flex w-11 h-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="w-5 h-5" aria-hidden="true" /></div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-6 text-muted-foreground">{text}</p></article>)}</div></div></section>
}

export default Features
