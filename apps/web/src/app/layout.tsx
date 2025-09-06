import type { Metadata } from 'next'
import { Header } from '@/components/navigation/Header'
import { ProjectProvider } from '@/components/providers/ProjectProvider'
import './globals.css'

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
      <body className="h-full bg-gray-50 text-foreground font-sans">
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