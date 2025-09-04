import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gantt Chart WebUI',
  description: 'Issue management with Gantt chart visualization',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="h-full">
      <body className={`${inter.className} h-full bg-background text-foreground`}>
        <div className="min-h-full">
          {children}
        </div>
      </body>
    </html>
  )
}