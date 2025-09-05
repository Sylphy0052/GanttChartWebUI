import { Page, expect, Locator } from '@playwright/test'

export class UIHelper {
  constructor(private page: Page) {}

  async waitForElement(selector: string, timeout = 30000) {
    await this.page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    })
    await this.page.waitForLoadState('networkidle')
  }

  async stableClick(selector: string) {
    await this.waitForElement(selector)
    await this.page.click(selector)
    await this.page.waitForTimeout(100) // Brief pause for UI response
  }

  async stableFill(selector: string, value: string) {
    await this.waitForElement(selector)
    await this.page.fill(selector, value)
  }

  async retryOperation(operation: () => Promise<void>, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await operation()
        return
      } catch (error) {
        if (i === maxRetries - 1) throw error
        await this.page.waitForTimeout(1000)
      }
    }
  }

  async navigateToPage(path: string) {
    await this.page.goto(path)
    await this.page.waitForLoadState('networkidle')
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle')
    
    // Wait for any common loading indicators to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '[aria-label="Loading"]'
    ]
    
    for (const selector of loadingSelectors) {
      await this.page.waitForSelector(selector, { 
        state: 'hidden',
        timeout: 5000 
      }).catch(() => {
        // Selector might not exist, continue
      })
    }
  }

  async verifyElementExists(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible()
  }

  async verifyElementText(selector: string, expectedText: string) {
    await expect(this.page.locator(selector)).toContainText(expectedText)
  }

  async verifyPageTitle(expectedTitle: string) {
    await expect(this.page).toHaveTitle(expectedTitle)
  }

  async verifyURL(expectedURL: string | RegExp) {
    await expect(this.page).toHaveURL(expectedURL)
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `e2e/screenshots/${name}.png` })
  }

  async dragAndDrop(sourceSelector: string, targetSelector: string) {
    const source = this.page.locator(sourceSelector)
    const target = this.page.locator(targetSelector)
    
    await source.dragTo(target)
    await this.page.waitForTimeout(500) // Wait for drag operation to complete
  }

  async selectOption(selector: string, value: string) {
    await this.waitForElement(selector)
    await this.page.selectOption(selector, value)
  }

  async uploadFile(selector: string, filePath: string) {
    await this.page.setInputFiles(selector, filePath)
  }

  async waitForAPIResponse(urlPattern: string | RegExp, timeout = 10000) {
    return await this.page.waitForResponse(resp => 
      typeof urlPattern === 'string' ? 
        resp.url().includes(urlPattern) : 
        urlPattern.test(resp.url()),
      { timeout }
    )
  }

  async getElementText(selector: string): Promise<string> {
    await this.waitForElement(selector)
    return await this.page.locator(selector).textContent() || ''
  }

  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count()
  }

  async isElementVisible(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { state: 'visible', timeout: 1000 })
      return true
    } catch {
      return false
    }
  }
}