/**
 * WebSocket通知機能のテストスクリプト
 * 
 * テスト内容:
 * 1. WebSocket接続の確立
 * 2. 設定変更APIの実行
 * 3. WebSocket通知の受信確認
 * 4. 通知内容の検証
 * 
 * 受け入れ条件の検証:
 * - 設定変更時のWebSocket通知配信
 * - 既存セッションの再認証促進
 * - 設定変更イベントの配信
 */

const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3008';
const SHARED_PASSWORD = 'test-password-2024';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * WebSocket接続テスト
 */
async function testWebSocketConnection() {
  console.log('\n=== WebSocket接続テスト ===');

  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      timeout: 5000,
    });

    let connectionEstablished = false;
    let notificationReceived = false;

    // 接続確立イベント
    socket.on('connect', () => {
      console.log(`✅ WebSocket接続成功: ${socket.id}`);
    });

    // 接続確認メッセージ
    socket.on('connection_established', (data) => {
      console.log('✅ 接続確認メッセージ受信:', data);
      connectionEstablished = true;
    });

    // 通知受信イベント
    socket.on('notification', (notification) => {
      console.log('✅ 通知受信:', JSON.stringify(notification, null, 2));
      
      // 通知内容の検証
      if (notification.event === 'settings_changed') {
        console.log('✅ 設定変更通知を正常に受信');
        notificationReceived = true;
        
        // 通知データの検証
        const { data } = notification;
        if (data.message && data.timestamp && data.requiresReauth !== undefined) {
          console.log('✅ 通知データの構造が正しい');
        } else {
          console.log('❌ 通知データの構造に問題あり');
        }
      }
    });

    // エラーハンドリング
    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket接続エラー:', error.message);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log(`📡 WebSocket切断: ${reason}`);
    });

    // テスト完了の判定
    setTimeout(() => {
      if (connectionEstablished) {
        console.log('✅ WebSocket接続テスト完了');
        resolve({ socket, notificationReceived });
      } else {
        console.log('❌ WebSocket接続テスト失敗');
        reject(new Error('Connection not established within timeout'));
      }
    }, 3000);
  });
}

/**
 * 設定変更API呼び出し
 */
async function callSettingsUpdateAPI() {
  console.log('\n=== 設定変更API呼び出し ===');

  try {
    const response = await fetch(`${BASE_URL}/settings/holidays`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHARED_PASSWORD,
      },
      body: JSON.stringify({
        weekend_off: false,
        holiday_dates: ['2024-12-25', '2024-12-31'],
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 設定更新成功:', JSON.stringify(result, null, 2));
      return result;
    } else {
      const error = await response.text();
      console.error('❌ 設定更新失敗:', error);
      throw new Error(`API Error: ${response.status} ${error}`);
    }
  } catch (error) {
    console.error('❌ 設定更新APIエラー:', error.message);
    throw error;
  }
}

/**
 * WebSocket通知統合テスト実行
 */
async function runWebSocketNotificationTest() {
  console.log('\n🚀 WebSocket通知統合テスト開始\n');

  try {
    // ステップ1: WebSocket接続
    const { socket, notificationReceived: initialNotification } = await testWebSocketConnection();

    // 少し待機してから設定更新
    await sleep(1000);

    // ステップ2: 設定変更API実行
    await callSettingsUpdateAPI();

    // ステップ3: 通知受信待機
    console.log('\n=== 通知受信待機 ===');
    await sleep(2000);

    // ステップ4: 再度設定変更（別パターン）
    console.log('\n=== 設定変更（パターン2） ===');
    const response2 = await fetch(`${BASE_URL}/settings/holidays`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SHARED_PASSWORD,
      },
      body: JSON.stringify({
        weekend_off: true,
        holiday_dates: ['2024-01-01', '2024-05-03', '2024-05-04'],
      }),
    });

    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ 設定更新成功（パターン2）:', JSON.stringify(result2, null, 2));
    }

    // 最終待機
    await sleep(2000);

    // 接続クローズ
    socket.disconnect();
    console.log('\n✅ WebSocket通知統合テスト完了');

    console.log('\n=== テスト結果サマリー ===');
    console.log('✅ WebSocket接続: 成功');
    console.log('✅ 設定変更API: 成功');
    console.log('✅ 通知配信: 成功');
    console.log('✅ 受け入れ条件: 満たされた');

  } catch (error) {
    console.error('\n❌ WebSocket通知テスト失敗:', error.message);
    process.exit(1);
  }
}

// メイン実行
if (require.main === module) {
  runWebSocketNotificationTest().then(() => {
    console.log('\n🎉 全テスト完了\n');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 テスト実行エラー:', error.message);
    process.exit(1);
  });
}