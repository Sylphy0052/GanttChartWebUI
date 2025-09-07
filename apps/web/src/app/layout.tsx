import type { Metadata } from 'next'
// import './globals.css' // Temporarily disabled to test CSS issues

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
    <html lang="ja">
      <body>
        {/* Absolute minimal layout to fix Application Error */}
        {children}
      </body>
    </html>
  )
}