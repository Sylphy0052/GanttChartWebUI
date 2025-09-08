'use client';

import NotificationDisplay from '@/components/NotificationDisplay';

export default function WebSocketDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          WebSocket通知デモ
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <NotificationDisplay />
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4">テスト手順</h2>
            <div className="space-y-4 text-sm">
              <div className="p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                <h3 className="font-medium text-blue-800 mb-2">WebSocket接続の確認</h3>
                <p className="text-blue-700">
                  左側の通知パネルで「接続中」の緑色のインジケーターが表示されていることを確認してください。
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded border-l-4 border-green-500">
                <h3 className="font-medium text-green-800 mb-2">Issue作成のテスト</h3>
                <p className="text-green-700 mb-2">
                  バックエンドAPIに以下のリクエストを送信してIssue作成通知をテストできます：
                </p>
                <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
{`POST /api/projects/{projectId}/issues
{
  "title": "WebSocket通知テスト",
  "description_md": "テスト用のIssueです",
  "assignee": "test-user",
  "status": "open"
}`}
                </pre>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded border-l-4 border-yellow-500">
                <h3 className="font-medium text-yellow-800 mb-2">Comment作成のテスト</h3>
                <p className="text-yellow-700 mb-2">
                  バックエンドAPIに以下のリクエストを送信してComment作成通知をテストできます：
                </p>
                <pre className="bg-gray-800 text-yellow-400 p-2 rounded text-xs overflow-x-auto">
{`POST /api/issues/{issueId}/comments
{
  "content": "WebSocket通知のテストコメントです",
  "author": "test-user"
}`}
                </pre>
              </div>
              
              <div className="p-4 bg-purple-50 rounded border-l-4 border-purple-500">
                <h3 className="font-medium text-purple-800 mb-2">期待される動作</h3>
                <ul className="text-purple-700 space-y-1 text-xs">
                  <li>• Issue作成時: 緑色の通知が表示される</li>
                  <li>• Issue更新時: 青色の通知が表示される</li>
                  <li>• Issue削除時: 赤色の通知が表示される</li>
                  <li>• Comment作成時: 黄色の通知が表示される</li>
                  <li>• Comment更新時: 紫色の通知が表示される</li>
                  <li>• Comment削除時: オレンジ色の通知が表示される</li>
                  <li>• 通知にはタイムスタンプとプロジェクトIDが含まれる</li>
                  <li>• 通知履歴に最新100件まで保存される</li>
                </ul>
              </div>
              
              <div className="p-4 bg-red-50 rounded border-l-4 border-red-500">
                <h3 className="font-medium text-red-800 mb-2">トラブルシューティング</h3>
                <ul className="text-red-700 space-y-1 text-xs">
                  <li>• 「切断中」表示の場合、バックエンドサーバーが起動していることを確認</li>
                  <li>• 通知が届かない場合、ブラウザの開発者ツールでWebSocketエラーを確認</li>
                  <li>• CORS設定を確認（backend WebSocket Gateway設定）</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}