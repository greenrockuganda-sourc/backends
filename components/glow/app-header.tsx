import Link from 'next/link'
import { ArrowDownToLine, Sparkles } from 'lucide-react'

export function AppHeader() {
  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="#top" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Glow home">
          <span className="flex w-8 h-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </span>
          <span>Glow</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground sm:flex" aria-label="Main navigation">
          <Link className="transition-colors hover:text-foreground" href="#features">Features</Link>
          <Link className="transition-colors hover:text-foreground" href="#screenshots">Preview</Link>
          <Link className="transition-colors hover:text-foreground" href="#download">Download</Link>
        </nav>
        <Link href="/downloads/glow.apk" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowDownToLine className="size-4" aria-hidden="true" />
          Get Glow
        </Link>
      </div>
    </header>
  )
}

export default AppHeader
