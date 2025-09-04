import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gantt Chart - Project Management',
  description: 'Interactive Gantt chart for project planning and tracking',
  keywords: 'gantt, chart, project, management, planning, timeline',
}

export default function GanttLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="h-screen overflow-hidden">
        {children}
      </main>
    </div>
  )
}