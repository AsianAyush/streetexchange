import Link from 'next/link'
import Image from 'next/image'
import { Twitter, Github, Shield, Zap } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0a0f] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-violet-500/20 group-hover:shadow-violet-500/40 group-hover:scale-105 transition-all flex items-center justify-center border border-white/10 bg-black/40">
                <Image
                  src="/logos/streetexchangelogo.png"
                  alt="StreetExchange Logo"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-bold text-lg text-white">
                Street<span className="text-violet-400">Exchange</span>
              </span>
            </Link>
            <p className="text-sm text-white/40 max-w-xs leading-relaxed">
              India&apos;s most trusted P2P crypto exchange. Convert INR to USDT (TRC-20) instantly with
              escrow-backed security.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-1.5 text-xs text-white/30">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                Escrow Protected
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/30">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Live Rates
              </div>
            </div>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Platform</h4>
            <ul className="space-y-3">
              {[
                { href: '/', label: 'Home' },
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/checkout', label: 'Buy USDT' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-3">
              {[
                { href: '/about', label: 'About Us' },
                { href: '/terms', label: 'Terms of Service' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/50 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">
            © {new Date().getFullYear()} StreetExchange. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/25 hover:text-white/60 transition-colors">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="#" className="text-white/25 hover:text-white/60 transition-colors">
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
