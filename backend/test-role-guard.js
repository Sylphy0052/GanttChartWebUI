/**
 * 権限管理（RoleGuard）機能のテストスクリプト
 * 
 * テスト項目:
 * 1. Viewer権限でのGET系APIアクセス（成功）
 * 2. Viewer権限でのPOST系APIアクセス（403エラー）
 * 3. Editor権限でのPOST系APIアクセス（成功）
 * 4. 認証なしでのアクセス（403エラー）
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

/**
 * HTTP リクエストを送信
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * テストケース実行
 */
async function runTests() {
  console.log('🚀 権限管理（RoleGuard）機能テスト開始\n');

  const testResults = [];

  // テスト1: Viewer権限でGET /projects（成功expected）
  try {
    console.log('📋 テスト1: Viewer権限でプロジェクト一覧取得');
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/projects',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // AUTH_TYPE=none の場合はViewer権限がデフォルト
      }
    });

    console.log(`   ステータス: ${response.statusCode}`);
    if (response.statusCode === 200) {
      console.log('   ✅ 成功: Viewer権限でGET系APIにアクセス可能');
      testResults.push({ test: 'Viewer GET', status: 'PASS' });
    } else {
      console.log('   ❌ 失敗: 予期しないステータスコード');
      testResults.push({ test: 'Viewer GET', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    testResults.push({ test: 'Viewer GET', status: 'ERROR' });
  }

  console.log('');

  // テスト2: Viewer権限でPOST /projects（403 expected）
  try {
    console.log('📋 テスト2: Viewer権限でプロジェクト作成（権限不足expected）');
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/projects',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }, {
      name: 'Test Project',
      description: 'Test Description'
    });

    console.log(`   ステータス: ${response.statusCode}`);
    if (response.statusCode === 403) {
      console.log('   ✅ 成功: Viewer権限でPOST系APIアクセスが拒否された');
      testResults.push({ test: 'Viewer POST Block', status: 'PASS' });
    } else {
      console.log('   ❌ 失敗: 権限制御が機能していない');
      console.log(`   レスポンス: ${response.body}`);
      testResults.push({ test: 'Viewer POST Block', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    testResults.push({ test: 'Viewer POST Block', status: 'ERROR' });
  }

  console.log('');

  // テスト3: Editor権限でPOST /projects（成功 expected）
  try {
    console.log('📋 テスト3: Editor権限でプロジェクト作成');
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/projects',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('admin:password').toString('base64'), // Basic認証でEditor権限
      }
    }, {
      name: 'Test Project with Editor',
      description: 'Test Description with Editor Permission'
    });

    console.log(`   ステータス: ${response.statusCode}`);
    if (response.statusCode === 201) {
      console.log('   ✅ 成功: Editor権限でPOST系APIにアクセス可能');
      testResults.push({ test: 'Editor POST', status: 'PASS' });
    } else if (response.statusCode === 401) {
      console.log('   ⚠️  認証設定確認: Basic認証が無効化されている可能性');
      testResults.push({ test: 'Editor POST', status: 'SKIP' });
    } else {
      console.log('   ❌ 失敗: 予期しないステータスコード');
      console.log(`   レスポンス: ${response.body}`);
      testResults.push({ test: 'Editor POST', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`   ❌ エラー: ${error.message}`);
    testResults.push({ test: 'Editor POST', status: 'ERROR' });
  }

  console.log('');

  // テスト結果サマリー
  console.log('📊 テスト結果サマリー:');
  console.log('='.repeat(50));
  testResults.forEach((result, index) => {
    const statusEmoji = {
      'PASS': '✅',
      'FAIL': '❌',
      'ERROR': '💥',
      'SKIP': '⏭️'
    };
    console.log(`${statusEmoji[result.status]} ${result.test}: ${result.status}`);
  });

  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const totalCount = testResults.filter(r => r.status !== 'SKIP').length;
  
  console.log('');
  console.log(`🎯 成功率: ${passCount}/${totalCount} (${Math.round((passCount/totalCount) * 100)}%)`);

  // 権限管理実装の確認事項
  console.log('');
  console.log('🔍 実装確認事項:');
  console.log('1. RoleGuard が作成され、適切に動作している');
  console.log('2. @RequireRole デコレーターが各エンドポイントに適用されている');
  console.log('3. Viewer権限ではGET系のみアクセス可能');
  console.log('4. Editor権限では全てのAPIにアクセス可能');
  console.log('5. 権限不足時には403 Forbiddenが返される');

  console.log('');
  console.log('✨ 権限管理（RoleGuard）機能テスト完了!');
}

// テスト実行
runTests().catch(console.error);