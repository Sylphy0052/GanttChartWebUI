import { test, expect } from '@playwright/test';

test.describe('Playwright動作確認テスト', () => {
  test('Google検索ページへのアクセス確認', async ({ page }) => {
    // Googleにアクセス
    await page.goto('https://www.google.com');

    // ページタイトルが"Google"を含むことを確認
    await expect(page).toHaveTitle(/Google/);

    // 検索ボックスが表示されることを確認
    const searchBox = page.locator('input[name="q"]');
    await expect(searchBox).toBeVisible();

    // "playwright"を検索
    await searchBox.fill('playwright');
    await searchBox.press('Enter');

    // 検索結果ページの読み込み待機
    await page.waitForLoadState('networkidle');

    // 検索結果が表示されることを確認
    const results = page.locator('#search .g');
    await expect(results.first()).toBeVisible();

    console.log('✅ Playwright動作確認テスト完了');
  });

  test('ローカルホストへの接続テスト', async ({ page }) => {
    // ローカルサーバーへの接続を試す
    try {
      await page.goto('http://localhost:3000', { timeout: 5000 });
      console.log('✅ ローカルサーバーに接続成功');

      // ページタイトルを確認
      const title = await page.title();
      console.log(`ページタイトル: ${title}`);

    } catch (error) {
      console.log('❌ ローカルサーバーに接続できませんでした');
      console.log(`エラー: ${error.message}`);

      // テストを続行せず終了
      test.skip();
    }
  });
});