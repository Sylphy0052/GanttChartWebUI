import type { Metadata } from 'next'
import { Header } from '@/components/navigation/Header'
import { Sidebar } from '@/components/navigation/Sidebar'
import { ProjectProvider } from '@/components/providers/ProjectProvider'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { ConflictDiffModal } from '@/components/error/ConflictDiffModal'
import { OfflineSyncStatus } from '@/components/sync/OfflineSyncStatus'
import { useConflictResolution } from '@/hooks/useConflictResolution'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gantt Chart WebUI',
  description: 'Issue management with Gantt chart visualization',
}

// Layout content component that uses hooks
function LayoutContent({ children }: { children: React.ReactNode }) {
  const {
    isConflictOpen,
    conflictError,
    localData,
    remoteData,
    entityType,
    entityId,
    resolveConflict,
    closeConflictResolution
  } = useConflictResolution()

  return (
    <>
      <div className="h-full flex flex-col">
        {/* AC5: Error boundary for header navigation */}
        <ErrorBoundary level="component" context={{ component: 'Header' }}>
          <Header />
        </ErrorBoundary>
        
        <div className="flex-1 flex">
          {/* AC5: Error boundary for sidebar navigation */}
          <ErrorBoundary level="component" context={{ component: 'Sidebar' }}>
            <Sidebar />
          </ErrorBoundary>
          
          {/* AC5: Error boundary for main content */}
          <ErrorBoundary level="page" context={{ component: 'MainContent' }}>
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </ErrorBoundary>
        </div>
        
        {/* AC4: Offline sync status indicator */}
        <div className="fixed bottom-4 right-4 z-50">
          <ErrorBoundary level="widget" context={{ component: 'OfflineSyncStatus' }}>
            <OfflineSyncStatus variant="compact" />
          </ErrorBoundary>
        </div>
      </div>

      {/* AC2 & AC3: Conflict resolution modal */}
      {conflictError && (
        <ErrorBoundary level="component" context={{ component: 'ConflictDiffModal' }}>
          <ConflictDiffModal
            isOpen={isConflictOpen}
            onClose={closeConflictResolution}
            conflictError={conflictError}
            localData={localData}
            remoteData={remoteData}
            onResolve={resolveConflict}
            entityType={entityType}
            entityId={entityId}
          />
        </ErrorBoundary>
      )}

      {/* AC1 & AC7: Toast notifications with enhanced error messages */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        containerClassName=""
        containerStyle={{
          top: 80, // Below the header
          right: 20,
          zIndex: 9999
        }}
        toastOptions={{
          // Default options for all toasts
          duration: 4000,
          style: {
            background: 'white',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            fontSize: '0.875rem',
            padding: '12px 16px',
            minWidth: '300px',
            maxWidth: '500px',
          },
          // Customize different toast types
          success: {
            duration: 3000,
            style: {
              border: '1px solid #10b981',
              background: '#f0fdf4',
              color: '#065f46',
            },
            iconTheme: {
              primary: '#10b981',
              secondary: '#f0fdf4',
            },
          },
          error: {
            duration: 8000, // Longer duration for errors with guidance
            style: {
              border: '1px solid #ef4444',
              background: '#fef2f2',
              color: '#991b1b',
            },
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fef2f2',
            },
          },
          loading: {
            duration: Infinity,
            style: {
              border: '1px solid #3b82f6',
              background: '#eff6ff',
              color: '#1d4ed8',
            },
          },
          // AC4: Offline-specific toast styling
          custom: {
            style: {
              border: '1px solid #f59e0b',
              background: '#fffbeb',
              color: '#92400e',
            },
          },
        }}
      />
    </>
  )
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full bg-gray-50 text-foreground font-sans">
        {/* AC5: App-level error boundary for the entire application */}
        <ErrorBoundary 
          level="app" 
          context={{ 
            component: 'RootLayout',
            url: typeof window !== 'undefined' ? window.location.href : 'unknown'
          }}
        >
          <ProjectProvider>
            <LayoutContent>
              {children}
            </LayoutContent>
          </ProjectProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}