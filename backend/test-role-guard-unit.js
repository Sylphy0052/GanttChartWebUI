/**
 * RoleGuard単体テストスクリプト
 */

const http = require('http');
const BASE_PORT = 3006;

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

async function testRoleGuard() {
  console.log('🔐 RoleGuard単体テスト開始\n');

  // テスト1: Viewer権限でGET (期待値: 200)
  try {
    console.log('📋 テスト1: GET /projects (Viewer権限)');
    const response = await makeRequest({
      hostname: 'localhost',
      port: BASE_PORT,
      path: '/projects',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`   ステータス: ${response.statusCode}`);
    console.log(`   レスポンス（先頭100文字）: ${response.body.substring(0, 100)}`);
    
    if (response.statusCode === 200) {
      console.log('   ✅ 成功: GET系API正常動作');
    } else {
      console.log('   ❌ 失敗: 予期しないステータスコード');
    }
  } catch (error) {
    console.log(`   💥 エラー: ${error.message}`);
  }

  console.log('');

  // テスト2: Viewer権限でPOST (期待値: 403)
  try {
    console.log('📋 テスト2: POST /projects (Viewer権限 -> 403期待)');
    const response = await makeRequest({
      hostname: 'localhost',
      port: BASE_PORT,
      path: '/projects',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }, {
      name: 'Test RoleGuard'
    });

    console.log(`   ステータス: ${response.statusCode}`);
    console.log(`   レスポンス（先頭200文字）: ${response.body.substring(0, 200)}`);
    
    if (response.statusCode === 403) {
      console.log('   ✅ 成功: 権限制御が正常動作');
    } else if (response.statusCode === 201) {
      console.log('   ❌ 失敗: 権限制御が機能していない（本来403であるべき）');
    } else {
      console.log(`   ❓ 予期しないレスポンス: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`   💥 エラー: ${error.message}`);
  }

  console.log('');

  // テスト3: プロジェクトパスワード認証ヘッダーでPOST (期待値: 201)
  try {
    console.log('📋 テスト3: POST /projects (Editor権限ヘッダー付き)');
    const response = await makeRequest({
      hostname: 'localhost',
      port: BASE_PORT,
      path: '/projects',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Project-Id': 'test-project-id',
        'X-Project-Password-Auth': 'true'
      }
    }, {
      name: 'Test RoleGuard with Auth'
    });

    console.log(`   ステータス: ${response.statusCode}`);
    console.log(`   レスポンス（先頭200文字）: ${response.body.substring(0, 200)}`);
    
    if (response.statusCode === 201) {
      console.log('   ✅ 成功: Editor権限で正常作成');
    } else if (response.statusCode === 403) {
      console.log('   ❌ 失敗: Editor権限が認識されていない');
    } else {
      console.log(`   ❓ 予期しないレスポンス: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`   💥 エラー: ${error.message}`);
  }

  console.log('');
  console.log('='.repeat(50));
  console.log('🔍 RoleGuard実装状況:');
  
  // 実装内容確認のために、簡単なファイル存在チェック
  const fs = require('fs');
  
  try {
    const roleGuardPath = './src/common/guards/role.guard.ts';
    const decoratorPath = './src/common/decorators/require-role.decorator.ts';
    
    if (fs.existsSync(roleGuardPath)) {
      console.log('   ✅ RoleGuard ファイルが存在');
    } else {
      console.log('   ❌ RoleGuard ファイルが見つからない');
    }
    
    if (fs.existsSync(decoratorPath)) {
      console.log('   ✅ RequireRole デコレーター ファイルが存在');
    } else {
      console.log('   ❌ RequireRole デコレーター ファイルが見つからない');
    }
  } catch (error) {
    console.log(`   ⚠️  ファイルチェックエラー: ${error.message}`);
  }

  console.log('');
  console.log('✨ テスト完了');
}

// テスト実行
testRoleGuard().catch(console.error);