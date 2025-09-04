import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header } from '@/components/navigation/Header'
import { ProjectProvider } from '@/components/providers/ProjectProvider'
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
      <body className={`${inter.className} h-full bg-gray-50 text-foreground`}>
        <ProjectProvider>
          <div className="min-h-full">
            <Header />
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ProjectProvider>
      </body>
    </html>
  )
}