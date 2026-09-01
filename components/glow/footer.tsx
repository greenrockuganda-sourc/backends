import Link from 'next/link'

export function Footer() {
  return <footer className="border-t border-border px-5 py-10 lg:px-8"><div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Glow</p><p className="mt-1 text-sm text-muted-foreground">Make space for your bright side.</p></div><nav className="flex gap-5 text-sm text-muted-foreground" aria-label="Footer navigation"><Link href="#features" className="hover:text-foreground">Features</Link><Link href="#screenshots" className="hover:text-foreground">Preview</Link><Link href="/downloads/glow.apk" className="hover:text-foreground">Download</Link></nav><p className="text-sm text-muted-foreground">© 2026 Glow Labs</p></div></footer>
}

export default Footer
