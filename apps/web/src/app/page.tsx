// Minimal page to fix Application Error
export default function HomePage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Gantt Chart WebUI</h1>
      <p>Issue management with Gantt chart visualization</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Available Pages:</h2>
        <ul style={{ listStyle: 'disc', marginLeft: '20px' }}>
          <li>
            <a href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>
              ログイン
            </a>
          </li>
          <li>
            <a href="/project" style={{ color: 'blue', textDecoration: 'underline' }}>
              プロジェクトビュー（WBS + Gantt）
            </a>
          </li>
          <li>
            <a href="/issues" style={{ color: 'blue', textDecoration: 'underline' }}>
              Issue一覧（ゲスト）
            </a>
          </li>
          <li>
            <a href="/wbs" style={{ color: 'blue', textDecoration: 'underline' }}>
              WBSツリー
            </a>
          </li>
        </ul>
      </div>
      
      <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
        <h3>デモアカウント</h3>
        <div>
          <strong>管理者:</strong> admin@example.com / admin123<br/>
          <strong>一般ユーザー:</strong> user@example.com / user123<br/>
          <strong>デモユーザー:</strong> demo@example.com / demo123
        </div>
      </div>
      
      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <p>API Status: Available at <a href="/api/health" style={{ color: 'blue' }}>/api/health</a></p>
        <p>API Documentation: <a href="http://localhost:3001/api/docs" target="_blank" style={{ color: 'blue' }}>http://localhost:3001/api/docs</a></p>
      </div>
    </div>
  )
}