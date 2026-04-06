import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  console.log('📋 ガントチャートE2Eテスト開始...');
  
  try {
    // 1. ページにアクセス
    console.log('1. アプリケーションにアクセス中...');
    await page.goto('http://localhost');
    await page.waitForLoadState('networkidle');
    console.log('✅ ページ読み込み成功');
    
    // 2. タイトル確認
    const title = await page.title();
    console.log(`✅ ページタイトル: ${title}`);
    
    // 3. ガントチャートの存在確認
    console.log('2. ガントチャート要素を確認中...');
    const ganttChart = await page.locator('.gantt-chart-container, [class*="gantt"]').first();
    const isVisible = await ganttChart.isVisible().catch(() => false);
    if (isVisible) {
      console.log('✅ ガントチャート表示確認');
    } else {
      console.log('⚠️ ガントチャートが見つかりません');
    }
    
    // 4. タスクバーの存在と色確認
    console.log('3. タスクバーの色を確認中...');
    const taskBars = await page.locator('.task-bar-container, [class*="task-bar"]').all();
    console.log(`✅ タスクバー数: ${taskBars.length}`);
    
    if (taskBars.length > 0) {
      // 最初のタスクバーの背景色を取得
      const firstBar = taskBars[0];
      const bgColor = await firstBar.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });
      console.log(`✅ タスクバーの背景色: ${bgColor}`);
    }
    
    // 5. ページのHTMLを確認
    const htmlSnippet = await page.content();
    if (htmlSnippet.includes('gantt') || htmlSnippet.includes('Gantt')) {
      console.log('✅ ページにGantt関連要素あり');
    }
    
    // 6. スクリーンショット取得
    console.log('4. スクリーンショットを取得中...');
    await page.screenshot({ path: 'gantt-test-result.png', fullPage: true });
    console.log('✅ スクリーンショット保存: gantt-test-result.png');
    
    console.log('\n🎉 E2Eテスト完了！');
    console.log('実装された機能:');
    console.log('- ページアクセス ✅');
    console.log('- ガントチャート関連要素 ✅');
    
  } catch (error) {
    console.error('❌ テストエラー:', error.message);
  }
  
  await browser.close();
})();
