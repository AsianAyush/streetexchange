import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Login — StreetExchange Control Panel',
  description: 'Secure admin portal for StreetExchange operations.',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-bg min-h-screen">
      {children}
    </div>
  )
}
