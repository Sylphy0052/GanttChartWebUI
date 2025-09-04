import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gantt Chart WebUI
          </h1>
          <p className="text-gray-600 mb-8">
            Issue management with Gantt chart visualization
          </p>
          
          <div className="space-y-4">
            <Link
              href="/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              ログイン
            </Link>
            
            <Link
              href="/issues"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Issue一覧（ゲスト）
            </Link>
          </div>
        </div>
        
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">デモアカウント</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">管理者:</span> admin@example.com / admin123
            </div>
            <div>
              <span className="font-medium">一般ユーザー:</span> user@example.com / user123
            </div>
            <div>
              <span className="font-medium">デモユーザー:</span> demo@example.com / demo123
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}