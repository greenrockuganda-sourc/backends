import AppHeader from '../../components/glow/app-header'
import Features from '../../components/glow/features'
import Footer from '../../components/glow/footer'
import Hero from '../../components/glow/hero'
import Screenshots from '../../components/glow/screenshots'

export default function GlowHomePage() {
  return <><AppHeader /><main><Hero /><Features /><Screenshots /><section className="px-5 pb-20 lg:px-8"><div className="mx-auto max-w-6xl rounded-[2rem] bg-foreground px-6 py-12 text-background sm:px-12 sm:py-16"><p className="eyebrow text-background/60">Ready when you are</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">Your next good habit is one tap away.</h2></div></section></main><Footer /></>
}
