const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3011';

/**
 * プロジェクトエクスポート機能テスト
 * 権限チェック、データ取得、ZIP作成をテスト
 */
async function testProjectExport() {
  console.log('=== プロジェクトエクスポート機能テスト開始 ===');

  try {
    // まずプロジェクトが存在するかを確認（権限不要）
    console.log('\n1. プロジェクト一覧取得テスト...');
    const listResponse = await fetch(`${BASE_URL}/api/projects`);
    
    if (!listResponse.ok) {
      console.log('❌ プロジェクト一覧取得失敗');
      return;
    }

    const projects = await listResponse.json();
    console.log(`✅ プロジェクト数: ${projects.length}`);

    if (projects.length === 0) {
      console.log('⚠️ テスト用プロジェクトがありません');
      return;
    }

    const testProject = projects[0];
    console.log(`📋 テスト対象プロジェクト: ${testProject.name} (${testProject.id})`);

    // 2. 権限なしでのアクセステスト
    console.log('\n2. 権限なしアクセステスト...');
    const noAuthResponse = await fetch(`${BASE_URL}/api/backup/export/${testProject.id}`, {
      method: 'POST',
    });

    console.log(`ステータス: ${noAuthResponse.status}`);
    if (noAuthResponse.status === 403) {
      console.log('✅ 権限チェックが正常に動作（403エラー）');
    } else if (noAuthResponse.status === 401) {
      console.log('✅ 認証チェックが正常に動作（401エラー）');
    } else {
      console.log(`❌ 予期しないステータス: ${noAuthResponse.status}`);
    }

    // 3. 無効なプロジェクトIDテスト
    console.log('\n3. 無効なプロジェクトIDテスト...');
    const invalidIdResponse = await fetch(`${BASE_URL}/api/backup/export/invalid-id`, {
      method: 'POST',
      headers: {
        'X-Project-Role': 'editor',
        'X-Project-ID': 'invalid-id',
      },
    });

    console.log(`ステータス: ${invalidIdResponse.status}`);
    if (invalidIdResponse.status === 400) {
      console.log('✅ 無効なプロジェクトID検証が正常に動作');
    } else {
      console.log(`❌ 予期しないステータス: ${invalidIdResponse.status}`);
    }

    // 4. Editor権限でのエクスポートテスト
    console.log('\n4. Editor権限エクスポートテスト...');
    const exportResponse = await fetch(`${BASE_URL}/api/backup/export/${testProject.id}`, {
      method: 'POST',
      headers: {
        'X-Project-Role': 'editor',
        'X-Project-ID': testProject.id,
      },
    });

    console.log(`ステータス: ${exportResponse.status}`);
    console.log(`Content-Type: ${exportResponse.headers.get('content-type')}`);
    console.log(`Content-Disposition: ${exportResponse.headers.get('content-disposition')}`);

    if (exportResponse.ok) {
      console.log('✅ エクスポートAPI呼び出し成功');
      
      // ファイルサイズをチェック
      const contentLength = exportResponse.headers.get('content-length');
      if (contentLength) {
        console.log(`📦 ファイルサイズ: ${Math.round(parseInt(contentLength) / 1024)}KB`);
      }

      // レスポンスのバイト数をカウント（実際のダウンロード確認）
      const buffer = await exportResponse.buffer();
      console.log(`📥 ダウンロードサイズ: ${Math.round(buffer.length / 1024)}KB`);
      
      if (buffer.length > 0) {
        console.log('✅ ZIPファイルのダウンロード成功');
        
        // テスト用にファイルを保存
        const filename = `test-export-${Date.now()}.zip`;
        fs.writeFileSync(filename, buffer);
        console.log(`💾 テストファイル保存: ${filename}`);
        
        // ファイル先頭がZIP形式かチェック（PK..）
        const header = buffer.slice(0, 4);
        if (header[0] === 0x50 && header[1] === 0x4B) {
          console.log('✅ 正常なZIPファイル形式');
        } else {
          console.log(`❌ ZIP形式ではない: ${Array.from(header).map(b => '0x' + b.toString(16)).join(' ')}`);
        }
      } else {
        console.log('❌ 空のレスポンス');
      }
    } else {
      const errorText = await exportResponse.text();
      console.log(`❌ エクスポート失敗: ${errorText}`);
    }

    // 5. Viewer権限でのアクセステスト
    console.log('\n5. Viewer権限アクセステスト...');
    const viewerResponse = await fetch(`${BASE_URL}/api/backup/export/${testProject.id}`, {
      method: 'POST',
      headers: {
        'X-Project-Role': 'viewer',
        'X-Project-ID': testProject.id,
      },
    });

    console.log(`ステータス: ${viewerResponse.status}`);
    if (viewerResponse.status === 403) {
      console.log('✅ Viewer権限では403エラーで正常にブロック');
    } else {
      console.log(`❌ 予期しないステータス: ${viewerResponse.status}`);
    }

    console.log('\n=== テスト完了 ===');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  }
}

// サーバーの起動確認
async function waitForServer() {
  console.log('サーバーの起動を待機中...');
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${BASE_URL}/health`, { timeout: 2000 });
      if (response.ok) {
        console.log('✅ サーバー起動確認');
        return true;
      }
    } catch (error) {
      // サーバーがまだ起動していない
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.stdout.write('.');
  }
  
  console.log('\n❌ サーバー起動タイムアウト');
  return false;
}

// メイン実行
async function main() {
  const serverReady = await waitForServer();
  if (serverReady) {
    await testProjectExport();
  }
}

main();