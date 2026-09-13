import type { Metadata } from 'next'
import { FileText, AlertTriangle, CheckCircle2, Scale, ShieldAlert, Clock, Network } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — StreetExchange',
  description:
    'StreetExchange Terms of Service: transaction limits ₹1,000–₹50,000, TRC-20 & BEP-20 address requirements, UTR verification procedures, AML compliance, and user obligations.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" />
            Legal & Compliance
          </div>
          <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
          <p className="text-white/40 text-sm">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-10 flex gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400 mb-1">Important Notice</p>
            <p className="text-sm text-white/60 leading-relaxed">
              By using StreetExchange, you agree to all terms below. Please read carefully before
              placing any order. These terms govern all P2P transactions on our platform.
            </p>
          </div>
        </div>

        <div className="space-y-8">

          {/* Section 1: Transaction Limits */}
          <div className="bg-card p-8 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-violet-400" />
              1. Transaction Limits & Boundaries
            </h2>
            <div className="space-y-4 text-sm text-white/60 leading-relaxed pt-2">
              <p>
                <strong className="text-white">1.1 Minimum Order:</strong> The minimum transaction amount on StreetExchange is{' '}
                <strong className="text-emerald-400">₹1,000 INR</strong> per order. Orders below this threshold will be automatically rejected at checkout.
              </p>
              <p>
                <strong className="text-white">1.2 Maximum Order:</strong> The maximum transaction amount is{' '}
                <strong className="text-amber-400">₹50,000 INR</strong> per single transaction. Users wishing to transact larger amounts must create separate orders, each within the per-transaction limit.
              </p>
              <p>
                <strong className="text-white">1.3 Rate Lock:</strong> The exchange rate displayed at the time of order creation is locked for the 15-minute payment window. Rates may change after this window expires and the order is cancelled.
              </p>
              <p>
                <strong className="text-white">1.4 USDT Calculation:</strong> USDT received is calculated as:{' '}
                <code className="text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded font-mono text-xs">
                  USDT = INR Amount ÷ Buy Rate per USDT
                </code>
                . Platform spreads are embedded in the buy/sell rate differential.
              </p>
            </div>
          </div>

          {/* Section 2: Network Address Requirements & Liability */}
          <div className="bg-card p-8 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              2. Network Address Requirements & Liability
            </h2>
            <div className="space-y-4 text-sm text-white/60 leading-relaxed pt-2">
              <p>
                <strong className="text-white">2.1 Supported Networks:</strong> StreetExchange processes USDT deliveries exclusively via two networks:{' '}
                <strong className="text-blue-400">TRON (TRC-20)</strong> and{' '}
                <strong className="text-amber-400">BNB Smart Chain (BEP-20)</strong>. Users must select their preferred network during order checkout.
              </p>
              <p>
                <strong className="text-white">2.2 TRC-20 Address Format:</strong> TRC-20 wallet addresses must conform to the TRON Base58 format: start with letter{' '}
                <code className="text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono text-xs">T</code>, exactly{' '}
                <code className="text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono text-xs">34</code> characters, using only valid Base58 characters (pattern:{' '}
                <code className="text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded font-mono text-xs">^T[a-km-zA-HJ-NP-Z1-9]{'{33}'}$</code>).
              </p>
              <p>
                <strong className="text-white">2.3 BEP-20 Address Format:</strong> BEP-20 (BNB Smart Chain) wallet addresses must conform to the standard EVM format: start with{' '}
                <code className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono text-xs">&quot;0x&quot;</code>, followed by exactly{' '}
                <code className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono text-xs">40</code> hexadecimal characters (pattern:{' '}
                <code className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono text-xs">^0x[a-fA-F0-9]{'{40}'}$</code>).
              </p>
              <p>
                <strong className="text-white">2.4 User Responsibility:</strong> Users bear sole responsibility for entering the correct wallet address corresponding to the network chosen at checkout. StreetExchange performs format validation but cannot and does not verify wallet ownership. Funds dispatched to a correctly-formatted address cannot be recalled.
              </p>
              <p>
                <strong className="text-white">2.5 Wrong Network & Cross-Chain Errors:</strong> Do not mix up networks. Providing a TRC-20 address while selecting BEP-20 (or vice versa), or using unsupported networks like ERC-20 (Ethereum), will result in permanent loss of funds. Funds sent to incorrect or mismatched network addresses due to user error are unrecoverable and StreetExchange bears no liability.
              </p>
              <p>
                <strong className="text-white">2.6 Address Verification:</strong> We strongly recommend verifying your wallet address by sending a test transaction of minimal value on the respective network before placing large orders.
              </p>
            </div>
          </div>

          {/* Section 3: UTR / IMPS Payment Verification */}
          <div className="bg-card p-8 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              3. UTR / IMPS Payment Verification
            </h2>
            <div className="space-y-4 text-sm text-white/60 leading-relaxed pt-2">
              <p>
                <strong className="text-white">3.1 Payment Window:</strong> After order creation, you have{' '}
                <strong className="text-white">5 to 15 minutes</strong> to complete the INR transfer to our UPI/IMPS banking details and submit your UTR reference number. Orders not confirmed within this window are automatically cancelled.
              </p>
              <p>
                <strong className="text-white">3.2 UTR Format:</strong> The Unique Transaction Reference (UTR) for IMPS/NEFT must be exactly{' '}
                <strong className="text-white">12 numeric digits</strong>. For UPI payments, use the UPI Reference Number (URN) / Transaction ID.
              </p>
              <p>
                <strong className="text-white">3.3 Verification Timeline:</strong> UTR verification is performed by StreetExchange operations within{' '}
                <strong className="text-white">10–30 minutes</strong> during business hours (9 AM–9 PM IST). After successful verification, USDT is dispatched to your specified wallet address on your chosen network.
              </p>
              <p>
                <strong className="text-white">3.4 Failed Payments:</strong> If your INR transfer does not reflect in our accounts within 2 hours of UTR submission, contact support with your Order ID and payment proof. Refunds for failed payments are processed within 24 business hours.
              </p>
            </div>
          </div>

          {/* Section 4: AML / KYC Compliance & Prohibited Activities */}
          <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-2xl p-8 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              4. AML / KYC Compliance & Prohibited Activities
            </h2>
            <div className="space-y-4 text-sm text-white/60 leading-relaxed pt-2">
              <p>
                <strong className="text-white">4.1 Anti-Money Laundering (AML):</strong> StreetExchange reserves the right to flag, delay, or reject any transaction suspected of being connected to money laundering, terrorist financing, or other illicit activities as defined under PMLA, 2002 (India).
              </p>
              <p>
                <strong className="text-white">4.2 Prohibited Sources:</strong> Users may not fund orders using proceeds from illegal activities, stolen funds, scam proceeds, or any funds that do not have a legitimate source. StreetExchange may report suspicious activity to relevant financial intelligence authorities.
              </p>
              <p>
                <strong className="text-white">4.3 Account Suspension:</strong> Accounts found to be engaged in layering, structuring transactions to avoid limits, or other AML-evasion techniques will be permanently suspended and reported to FINTRAC/FIU-IND.
              </p>
              <p>
                <strong className="text-white">4.4 Cooperation with Authorities:</strong> StreetExchange will cooperate with law enforcement agencies and provide transaction records upon receipt of valid legal process (court order, subpoena, or regulatory directive).
              </p>
            </div>
          </div>

          {/* Section 5: Risk Disclosures & Disclaimers */}
          <div className="bg-card p-8 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              5. Risk Disclosures & Disclaimers
            </h2>
            <div className="space-y-4 text-sm text-white/60 leading-relaxed pt-2">
              <p>
                <strong className="text-white">5.1 Market Volatility:</strong> Cryptocurrency prices are highly volatile. The USDT/INR exchange rate displayed is live and may differ significantly from rates at time of checkout completion.
              </p>
              <p>
                <strong className="text-white">5.2 Regulatory Risk:</strong> Cryptocurrency regulations in India are evolving. StreetExchange may be required to suspend operations, modify services, or implement additional KYC/AML measures at any time.
              </p>
              <p>
                <strong className="text-white">5.3 Platform Availability:</strong> StreetExchange operates on a best-effort basis. Maintenance windows, Supabase infrastructure downtime, or other technical issues may temporarily affect service availability. We target 99.9% uptime but provide no uptime guarantees.
              </p>
              <p>
                <strong className="text-white">5.4 Limitation of Liability:</strong> StreetExchange&apos;s aggregate liability for any claim arising out of or related to these terms shall not exceed the INR amount of the disputed transaction.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
