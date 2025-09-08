/**
 * 簡単なWebSocket通知機能テスト
 */

const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3008';
const SHARED_PASSWORD = 'test-password-2024';

console.log('🚀 簡単なWebSocket通知テスト開始');

// WebSocket接続
const socket = io(BASE_URL);

socket.on('connect', () => {
  console.log('✅ WebSocket接続成功:', socket.id);
});

socket.on('connection_established', (data) => {
  console.log('✅ 接続確認:', data);
  
  // 接続確認後、設定変更API実行
  setTimeout(async () => {
    console.log('\n📡 設定変更API実行中...');
    
    try {
      const response = await fetch(`${BASE_URL}/settings/holidays`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SHARED_PASSWORD,
        },
        body: JSON.stringify({
          weekend_off: true,
          holiday_dates: ['2024-12-25'],
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ 設定更新成功:', result);
      } else {
        console.error('❌ 設定更新失敗:', response.status);
      }
    } catch (error) {
      console.error('❌ API エラー:', error.message);
    }
  }, 1000);
});

socket.on('notification', (notification) => {
  console.log('🔔 通知受信!');
  console.log('  イベント:', notification.event);
  console.log('  メッセージ:', notification.data.message);
  console.log('  タイムスタンプ:', notification.data.timestamp);
  console.log('  再認証要求:', notification.data.requiresReauth);
  
  console.log('\n✅ WebSocket通知機能テスト完了!');
  
  // テスト終了
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.error('❌ 接続エラー:', error.message);
});

// タイムアウト
setTimeout(() => {
  console.error('⏰ テストタイムアウト');
  process.exit(1);
}, 10000);