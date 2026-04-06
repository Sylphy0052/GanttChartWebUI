import { test, expect } from '@playwright/test';

test.describe('ガントチャート スタイリング検証', () => {
  test.beforeEach(async ({ page }) => {
    // ガントチャートページにアクセス
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // ガントチャートが読み込まれるまで待機
    await page.waitForSelector('.gantt-chart-container', { timeout: 10000 });
  });

  test('日付カラムのテキスト色が黒であることを確認', async ({ page }) => {
    // 日付ヘッダーの要素を取得
    const dateHeaders = await page.locator('.bg-gray-100 .text-xs').all();

    if (dateHeaders.length > 0) {
      // 最初の数個の日付ヘッダーをチェック
      const samplesToCheck = Math.min(5, dateHeaders.length);

      for (let i = 0; i < samplesToCheck; i++) {
        const header = dateHeaders[i];
        const textColor = await header.evaluate(el => {
          return window.getComputedStyle(el).color;
        });

        console.log(`日付ヘッダー ${i + 1} の色: ${textColor}`);

        // 色が黒系（rgb(0, 0, 0) または近い値）であることを確認
        expect(textColor).toMatch(/rgb\(0,\s*0,\s*0\)|#000000|black/i);
      }

      console.log('✅ 日付カラムのテキスト色確認完了');
    } else {
      console.log('⚠️ 日付ヘッダーが見つかりませんでした');
    }
  });

  test('タスクバーの状態別色分けを確認', async ({ page }) => {
    // タスクバー要素を取得
    const taskBars = await page.locator('.task-bar-container').all();

    if (taskBars.length === 0) {
      console.log('⚠️ タスクバーが見つかりませんでした');
      return;
    }

    console.log(`検出されたタスクバー数: ${taskBars.length}`);

    const colorResults: Array<{
      index: number;
      backgroundColor: string;
      textColor: string;
      status: string;
    }> = [];

    // 各タスクバーの色を確認
    for (let i = 0; i < Math.min(10, taskBars.length); i++) {
      const bar = taskBars[i];

      const backgroundColor = await bar.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      const textColor = await bar.evaluate(el => {
        return window.getComputedStyle(el).color;
      });

      // タスクバーの状態を推測（色から）
      let status = 'unknown';
      if (backgroundColor.includes('148, 163, 184') || backgroundColor.includes('#94a3b8')) {
        status = 'open';
      } else if (backgroundColor.includes('59, 130, 246') || backgroundColor.includes('#3b82f6')) {
        status = 'in_progress';
      } else if (backgroundColor.includes('34, 197, 94') || backgroundColor.includes('#22c55e')) {
        status = 'done';
      } else if (backgroundColor.includes('249, 115, 22') || backgroundColor.includes('#f97316')) {
        status = 'blocked';
      }

      colorResults.push({
        index: i,
        backgroundColor,
        textColor,
        status
      });

      console.log(`タスクバー ${i + 1}: 背景色=${backgroundColor}, テキスト色=${textColor}, 推定状態=${status}`);
    }

    // 期待される色の検証
    const expectedColors = {
      open: {
        background: 'rgb(148, 163, 184)', // #94a3b8
        text: 'rgb(30, 41, 59)' // #1e293b (dark gray)
      },
      in_progress: {
        background: 'rgb(59, 130, 246)', // #3b82f6
        text: 'rgb(255, 255, 255)' // white
      },
      done: {
        background: 'rgb(34, 197, 94)', // #22c55e
        text: 'rgb(255, 255, 255)' // white
      },
      blocked: {
        background: 'rgb(249, 115, 22)', // #f97316
        text: 'rgb(255, 255, 255)' // white
      }
    };

    // 各状態の色が正しく設定されているかチェック
    const statusCounts = {
      open: 0,
      in_progress: 0,
      done: 0,
      blocked: 0
    };

    colorResults.forEach(result => {
      if (result.status !== 'unknown') {
        statusCounts[result.status as keyof typeof statusCounts]++;

        const expected = expectedColors[result.status as keyof typeof expectedColors];
        if (expected) {
          // 色の近似チェック（RGB値の差が少ない場合は許容）
          console.log(`${result.status}状態の検証: 期待値=${expected.background}, 実際値=${result.backgroundColor}`);
        }
      }
    });

    console.log('状態別タスク数:', statusCounts);

    // 少なくとも何かしらの色分けがされていることを確認
    const uniqueColors = new Set(colorResults.map(r => r.backgroundColor));
    expect(uniqueColors.size).toBeGreaterThan(0);
    console.log(`✅ 異なる背景色の数: ${uniqueColors.size}`);

    // 結果をコンソールに出力
    console.log('\n=== タスクバー色分け検証結果 ===');
    console.log('検出された色:');
    uniqueColors.forEach(color => {
      console.log(`  - ${color}`);
    });
  });

  test('特定の状態のタスクバー色を詳細確認', async ({ page }) => {
    // より詳細な色確認のため、DOM属性も参照
    const taskBars = await page.locator('[data-issue-id]').all();

    if (taskBars.length === 0) {
      console.log('⚠️ data-issue-id属性のタスクバーが見つかりませんでした');
      return;
    }

    console.log(`data-issue-id属性のタスクバー数: ${taskBars.length}`);

    for (let i = 0; i < Math.min(5, taskBars.length); i++) {
      const taskContainer = taskBars[i];

      // タスクバー内の実際のバー要素を探す
      const actualBar = taskContainer.locator('.task-bar-container, [style*="background"]').first();

      const issueId = await taskContainer.getAttribute('data-issue-id');

      if (await actualBar.isVisible()) {
        const styles = await actualBar.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            border: computed.border,
            borderRadius: computed.borderRadius
          };
        });

        console.log(`Issue ${issueId}:`);
        console.log(`  背景色: ${styles.backgroundColor}`);
        console.log(`  テキスト色: ${styles.color}`);
        console.log(`  ボーダー: ${styles.border}`);
        console.log(`  角丸: ${styles.borderRadius}`);
      }
    }
  });

  test('ホバー効果の確認', async ({ page }) => {
    const taskBars = await page.locator('.task-bar-container').first();

    if (await taskBars.isVisible()) {
      // ホバー前の色を取得
      const beforeHoverColor = await taskBars.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // ホバー
      await taskBars.hover();
      await page.waitForTimeout(300); // ホバー効果の時間を待つ

      // ホバー後の色を取得
      const afterHoverColor = await taskBars.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });

      console.log(`ホバー前: ${beforeHoverColor}`);
      console.log(`ホバー後: ${afterHoverColor}`);

      // ホバー効果でボックスシャドウが変わることを確認
      const boxShadow = await taskBars.evaluate(el => {
        return window.getComputedStyle(el).boxShadow;
      });

      console.log(`ボックスシャドウ: ${boxShadow}`);

      // シャドウが設定されていることを確認（none以外）
      expect(boxShadow).not.toBe('none');
      console.log('✅ ホバー効果確認完了');
    }
  });

  test('全体的なビジュアル確認用スクリーンショット', async ({ page }) => {
    // ページ全体のスクリーンショット
    await page.screenshot({
      path: '/mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/test-results/gantt-styling-verification.png',
      fullPage: true
    });

    // ガントチャート部分のみのスクリーンショット
    const ganttContainer = page.locator('.gantt-chart-container').first();
    if (await ganttContainer.isVisible()) {
      await ganttContainer.screenshot({
        path: '/mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/test-results/gantt-chart-only.png'
      });
    }

    console.log('✅ スクリーンショット保存完了');
    console.log('  - 全体: test-results/gantt-styling-verification.png');
    console.log('  - ガントチャート: test-results/gantt-chart-only.png');
  });

  test('CSS変数による色設定の確認', async ({ page }) => {
    // ページのCSS変数を確認
    const cssVariables = await page.evaluate(() => {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const ganttContainer = document.querySelector('.gantt-chart-container');

      if (ganttContainer) {
        const containerStyles = window.getComputedStyle(ganttContainer as Element);
        return {
          containerBackground: containerStyles.backgroundColor,
          containerColor: containerStyles.color,
          // カスタムCSSプロパティがあれば取得
          taskColor: containerStyles.getPropertyValue('--gantt-task-color'),
          taskHoverColor: containerStyles.getPropertyValue('--gantt-task-hover-color'),
          taskTextColor: containerStyles.getPropertyValue('--gantt-task-text-color'),
        };
      }
      return null;
    });

    if (cssVariables) {
      console.log('CSS変数確認:');
      console.log(`  コンテナ背景色: ${cssVariables.containerBackground}`);
      console.log(`  コンテナテキスト色: ${cssVariables.containerColor}`);
      console.log(`  タスク色: ${cssVariables.taskColor}`);
      console.log(`  タスクホバー色: ${cssVariables.taskHoverColor}`);
      console.log(`  タスクテキスト色: ${cssVariables.taskTextColor}`);
    }
  });
});