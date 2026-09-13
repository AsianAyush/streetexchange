import type { Metadata } from 'next'
import { Shield, Users, Globe, Award, Lock, RefreshCw, Zap, CheckCircle2, ShieldCheck, ArrowRight, Network, Coins } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Us — StreetExchange P2P Crypto Exchange',
  description:
    'Learn how StreetExchange provides safe, escrow-backed P2P INR-to-USDT exchange for Indian crypto traders across TRON (TRC-20) and BNB Smart Chain (BEP-20) networks.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        {/* Hero / Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5" />
            About StreetExchange
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Building India&apos;s Most Trusted<br />
            <span className="gradient-text">P2P Crypto Exchange</span>
          </h1>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            We exist to bring transparency, security, and speed to the Indian crypto peer-to-peer trading ecosystem — one verified trade at a time.
          </p>
        </div>

        {/* Our Mission */}
        <div className="bg-card p-8 rounded-2xl border border-white/5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Award className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Our Mission</h2>
          </div>
          <p className="text-white/60 leading-relaxed text-sm sm:text-base pt-1">
            StreetExchange was founded with a singular mission: to provide Indian traders with a reliable, transparent, and secure platform to convert Indian Rupees (INR) to USDT across both the <strong className="text-blue-400">TRON (TRC-20)</strong> and <strong className="text-amber-400">BNB Smart Chain (BEP-20)</strong> networks. We bridge the gap between traditional INR banking rails and the decentralized world of stablecoins, without the opacity or risk that plagues many unregulated P2P channels.
          </p>
        </div>

        {/* How Our Escrow System Works */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">How Our Escrow System Works</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                title: 'Pre-funded Crypto Reserve',
                desc: 'StreetExchange maintains a pre-funded reserve of USDT (TRC-20 and BEP-20) held in a cold-storage escrow wallet. This ensures every buy order has guaranteed liquidity before you even initiate a trade.',
              },
              {
                title: 'INR Payment Verification',
                desc: 'When you submit a UTR/IMPS reference, our admin team cross-verifies the transaction on the banking network within minutes. No assumptions — every rupee is tracked.',
              },
              {
                title: 'Atomic Dispatch',
                desc: 'USDT is dispatched exclusively to the wallet address you specified during checkout — verified by our strict network regex checkers (Base58 for TRON, EVM hex for BEP-20). We never hold your crypto longer than required.',
              },
              {
                title: 'Dispute Resolution',
                desc: 'If a payment is not received within the 15-minute window, your order is automatically cancelled with zero financial risk to you. No partial states, no locked funds.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-black/30 border border-emerald-500/20 rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                </div>
                <p className="text-xs text-white/50 leading-relaxed pl-6">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Additional Escrow Pillars */}
          <div className="grid md:grid-cols-3 gap-4 pt-2">
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-violet-400 text-xs font-semibold">
                <Shield className="w-4 h-4" />
                Security First
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Supabase Row-Level Security (RLS) ensures your data and orders are completely isolated from other users.
              </p>
            </div>

            <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                <RefreshCw className="w-4 h-4" />
                Real-Time Transparency
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Live WebSocket rate streaming means you always trade at the exact rate shown — no last-minute surprises.
              </p>
            </div>

            <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <Users className="w-4 h-4" />
                Community-Driven
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                We operate like a tight-knit P2P community — responsive support, transparent fees, and community-first policies.
              </p>
            </div>
          </div>
        </div>

        {/* Why TRC-20 & BEP-20 Networks? */}
        <div className="bg-card p-8 rounded-2xl border border-white/5 space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Network className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Why TRC-20 & BEP-20 Networks?</h2>
              <p className="text-xs text-white/40 mt-0.5">
                We deliver USDT across high-performance, cost-effective networks tailored to your preference:
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                title: 'Near-zero fees:',
                desc: 'Both TRC-20 and BEP-20 transfers cost fractions of a cent in gas fees, completely avoiding high Ethereum (ERC-20) congestion costs.',
              },
              {
                title: 'Fast finality:',
                desc: 'Transactions confirm in seconds on both the TRON and BNB Smart Chain blockchains.',
              },
              {
                title: 'Widely supported:',
                desc: 'Our supported network tokens are accepted on Binance, OKX, Bybit, KuCoin, and virtually all major crypto exchanges and wallets.',
              },
              {
                title: 'Address security:',
                desc: 'Our automated regex validators ensure only valid TRON addresses (^T[a-km-zA-HJ-NP-Z1-9]{33}$) or EVM/BEP-20 addresses (^0x[a-fA-F0-9]{40}$) are accepted during checkout.',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 bg-white/2 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                <span className="text-violet-400 font-bold text-base shrink-0 mt-0.5">→</span>
                <div className="text-sm">
                  <span className="font-bold text-white mr-1.5">{item.title}</span>
                  <span className="text-white/60 leading-relaxed">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="bg-gradient-to-b from-white/3 to-transparent border border-white/5 rounded-2xl p-8 text-center space-y-3">
          <h2 className="text-2xl font-bold text-white">A Lean, Expert Team</h2>
          <p className="text-white/50 leading-relaxed max-w-2xl mx-auto text-sm sm:text-base">
            StreetExchange is operated by a small team of fintech and blockchain professionals with combined experience in banking technology, DeFi protocols, and compliance. We are committed to building the exchange we ourselves wished existed.
          </p>
          <div className="pt-3">
            <span className="text-xs text-white/25 font-mono bg-white/5 px-3 py-1 rounded-full border border-white/5">
              Next.js · Supabase Realtime · TRC-20 · BEP-20 Escrow
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
