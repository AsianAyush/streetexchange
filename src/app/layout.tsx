import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthProvider'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'StreetExchange — P2P INR to USDT Exchange',
  description:
    'India\'s most trusted peer-to-peer crypto exchange. Buy USDT (TRC-20) with INR instantly. Escrow-protected, live rates, zero middleman.',
  keywords: 'USDT buy India, INR to USDT, P2P crypto exchange, TRC-20 USDT, crypto exchange India',
  openGraph: {
    title: 'StreetExchange — P2P INR to USDT Exchange',
    description: 'Buy USDT (TRC-20) with INR — live rates, escrow-protected.',
    type: 'website',
  },
  icons: {
    icon: '/logos/streetexchangelogo.png',
    apple: '/logos/streetexchangelogo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#0a0a0f] text-white antialiased min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  )
}
