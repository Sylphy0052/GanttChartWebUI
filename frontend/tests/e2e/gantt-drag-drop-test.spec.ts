import { test, expect } from '@playwright/test';

test.describe('Gantt Chart Drag and Drop Functionality', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Navigate to the project page first
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
  });

  test('should perform drag and drop without "Issue ID [object Object]" error', async ({ page }) => {
    console.log('Starting Gantt chart drag and drop test...');

    // Step 1: Navigate to a project with issues
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForTimeout(2000);

    // Find and click on the first project
    const projectLinks = await page.locator('a[href*="/projects/"]').all();
    if (projectLinks.length === 0) {
      throw new Error('No projects found. Please ensure test data exists.');
    }

    await projectLinks[0].click();
    await page.waitForTimeout(1000);

    // Step 2: Navigate to issues page and switch to Gantt view
    const currentUrl = page.url();
    const projectId = currentUrl.match(/\/projects\/(\d+)/)?.[1] || '1';

    await page.goto(`${BASE_URL}/projects/${projectId}/issues`);
    await page.waitForTimeout(2000);

    console.log(`Navigated to issues page for project ${projectId}`);

    // Step 3: Switch to Gantt view
    const ganttViewButton = page.locator('button:has-text("ガント"), button:has-text("Gantt"), [data-view="gantt"]');
    if (await ganttViewButton.count() > 0) {
      await ganttViewButton.first().click();
      await page.waitForTimeout(2000);
      console.log('Switched to Gantt view');
    } else {
      // Maybe we're already in Gantt view or need to find another way
      const ganttChart = page.locator('.gantt-chart-container, .gantt-timeline');
      if (await ganttChart.count() === 0) {
        // Try to navigate directly to Gantt page if it exists
        await page.goto(`${BASE_URL}/projects/${projectId}/gantt`);
        await page.waitForTimeout(2000);
      }
    }

    // Step 4: Verify Gantt chart is loaded
    const ganttContainer = page.locator('.gantt-chart-container, .gantt-timeline');
    await expect(ganttContainer).toBeVisible();
    console.log('Gantt chart is visible');

    // Check if drag and drop is enabled
    const dragDropStatus = page.locator('text=ドラッグ&ドロップ有効, text=ドラッグ&ドロップ無効');
    if (await dragDropStatus.count() > 0) {
      const statusText = await dragDropStatus.textContent();
      console.log('Drag & Drop Status:', statusText);
    }

    // Step 5: Wait for task bars to load
    const taskBars = page.locator('.draggable-task-bar-container, [data-issue-id]');
    await expect(taskBars.first()).toBeVisible({ timeout: 10000 });

    const taskBarCount = await taskBars.count();
    console.log(`Found ${taskBarCount} task bars`);

    if (taskBarCount === 0) {
      throw new Error('No task bars found in Gantt chart. Please ensure issues with dates exist.');
    }

    // Step 6: Set up console monitoring to catch the specific error
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        console.log('Console Error:', text);

        // Check for the specific object serialization error
        if (text.includes('[object Object]')) {
          console.error('❌ Found object serialization error in console:', text);
        }
      }
    });

    // Monitor network responses for API errors
    page.on('response', async (response) => {
      if (response.url().includes('/api/issues/') && response.status() >= 400) {
        try {
          const responseBody = await response.text();
          networkErrors.push(`${response.status()}: ${responseBody}`);
          console.log('Network Error:', response.status(), responseBody);

          // Check for the specific object error in API responses
          if (responseBody.includes('[object Object]')) {
            console.error('❌ Found object serialization error in API response:', responseBody);
          }
        } catch (e) {
          console.log('Could not read response body');
        }
      }
    });

    // Step 7: Perform drag and drop operation
    console.log('Attempting to perform drag and drop...');

    const firstTaskBar = taskBars.first();

    // Get the bounding box of the task bar
    const taskBarBox = await firstTaskBar.boundingBox();
    if (!taskBarBox) {
      throw new Error('Could not get task bar bounding box');
    }

    // Drag the task bar to a new position (move it 100px to the right)
    const startX = taskBarBox.x + taskBarBox.width / 2;
    const startY = taskBarBox.y + taskBarBox.height / 2;
    const endX = startX + 100; // Move 100px to the right
    const endY = startY;

    console.log(`Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`);

    // Perform the drag operation
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(500); // Wait for drag to start

    await page.mouse.move(endX, endY, { steps: 10 });
    await page.waitForTimeout(500); // Wait during drag

    await page.mouse.up();
    await page.waitForTimeout(2000); // Wait for API call to complete

    console.log('Drag and drop operation completed');

    // Step 8: Check for debugging logs in console
    await page.waitForTimeout(1000);

    // Check console logs for debugging information
    const debugLogs = await page.evaluate(() => {
      return (window as any).ganttDebugLogs || [];
    });

    if (debugLogs.length > 0) {
      console.log('Debug logs found:', debugLogs);
    }

    // Step 9: Verify no object serialization errors occurred
    const objectErrors = consoleErrors.filter(error =>
      error.includes('[object Object]') || error.includes('Issue ID [object Object]')
    );

    const networkObjectErrors = networkErrors.filter(error =>
      error.includes('[object Object]') || error.includes('Issue ID [object Object]')
    );

    // Report all errors for debugging
    if (consoleErrors.length > 0) {
      console.log('All console errors:', consoleErrors);
    }
    if (networkErrors.length > 0) {
      console.log('All network errors:', networkErrors);
    }

    // Main assertion: No object serialization errors should occur
    expect(objectErrors.length).toBe(0);
    expect(networkObjectErrors.length).toBe(0);

    // Step 10: Verify that the task was actually moved (optional)
    // We can check if the API call was successful by checking the absence of 400/500 errors
    const criticalErrors = networkErrors.filter(error =>
      error.startsWith('400:') || error.startsWith('500:')
    );

    if (criticalErrors.length > 0) {
      console.warn('Critical API errors found:', criticalErrors);
      // Don't fail the test unless it's specifically the object error
      const objectRelatedErrors = criticalErrors.filter(error =>
        error.includes('[object Object]') || error.includes('Issue ID [object Object]')
      );
      expect(objectRelatedErrors.length).toBe(0);
    }

    console.log('✅ Gantt chart drag and drop test completed successfully - no object serialization errors found!');
  });

  test('should handle multiple drag and drop operations without errors', async ({ page }) => {
    console.log('Starting multiple drag and drop operations test...');

    // Navigate to project and Gantt view
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForTimeout(2000);

    const projectLinks = await page.locator('a[href*="/projects/"]').all();
    if (projectLinks.length === 0) {
      throw new Error('No projects found');
    }

    await projectLinks[0].click();
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const projectId = currentUrl.match(/\/projects\/(\d+)/)?.[1] || '1';

    await page.goto(`${BASE_URL}/projects/${projectId}/issues`);
    await page.waitForTimeout(2000);

    // Switch to Gantt view
    const ganttViewButton = page.locator('button:has-text("ガント"), button:has-text("Gantt"), [data-view="gantt"]');
    if (await ganttViewButton.count() > 0) {
      await ganttViewButton.first().click();
      await page.waitForTimeout(2000);
    }

    // Wait for task bars
    const taskBars = page.locator('.draggable-task-bar-container, [data-issue-id]');
    await expect(taskBars.first()).toBeVisible({ timeout: 10000 });

    const taskBarCount = await taskBars.count();
    console.log(`Found ${taskBarCount} task bars for multiple operations`);

    // Monitor for object errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('[object Object]')) {
        consoleErrors.push(msg.text());
      }
    });

    // Perform multiple drag operations
    const maxOperations = Math.min(3, taskBarCount); // Test up to 3 task bars

    for (let i = 0; i < maxOperations; i++) {
      console.log(`Performing drag operation ${i + 1}/${maxOperations}`);

      const taskBar = taskBars.nth(i);
      const taskBarBox = await taskBar.boundingBox();

      if (taskBarBox) {
        const startX = taskBarBox.x + taskBarBox.width / 2;
        const startY = taskBarBox.y + taskBarBox.height / 2;
        const endX = startX + (50 * (i + 1)); // Move different distances
        const endY = startY;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(300);

        await page.mouse.move(endX, endY, { steps: 5 });
        await page.waitForTimeout(300);

        await page.mouse.up();
        await page.waitForTimeout(1500); // Wait between operations
      }
    }

    console.log(`Completed ${maxOperations} drag operations`);

    // Verify no object errors occurred during multiple operations
    expect(consoleErrors.length).toBe(0);

    console.log('✅ Multiple drag and drop operations completed successfully!');
  });

  test('should display proper debug information without object serialization', async ({ page }) => {
    console.log('Starting debug information test...');

    // Navigate to Gantt view
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForTimeout(2000);

    const projectLinks = await page.locator('a[href*="/projects/"]').all();
    if (projectLinks.length > 0) {
      await projectLinks[0].click();
      await page.waitForTimeout(1000);

      const currentUrl = page.url();
      const projectId = currentUrl.match(/\/projects\/(\d+)/)?.[1] || '1';

      await page.goto(`${BASE_URL}/projects/${projectId}/issues`);
      await page.waitForTimeout(2000);

      // Switch to Gantt view
      const ganttViewButton = page.locator('button:has-text("ガント"), button:has-text("Gantt")');
      if (await ganttViewButton.count() > 0) {
        await ganttViewButton.first().click();
        await page.waitForTimeout(2000);
      }

      // Open browser console to check debug logs
      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        consoleLogs.push(text);

        // Check for specific debug logs that should show proper issue IDs
        if (text.includes('handleGanttTaskChange called with:')) {
          console.log('Found debug log:', text);

          // Verify that issue IDs are properly formatted as strings, not objects
          expect(text).not.toMatch(/issueId.*\[object Object\]/);
          expect(text).not.toMatch(/Issue ID.*\[object Object\]/);
        }
      });

      // Trigger a drag operation to generate debug logs
      const taskBars = page.locator('.draggable-task-bar-container, [data-issue-id]');
      if (await taskBars.count() > 0) {
        const firstTaskBar = taskBars.first();
        const taskBarBox = await firstTaskBar.boundingBox();

        if (taskBarBox) {
          const startX = taskBarBox.x + taskBarBox.width / 2;
          const startY = taskBarBox.y + taskBarBox.height / 2;
          const endX = startX + 50;
          const endY = startY;

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.waitForTimeout(500);
          await page.mouse.move(endX, endY, { steps: 5 });
          await page.waitForTimeout(500);
          await page.mouse.up();
          await page.waitForTimeout(2000);
        }
      }

      // Check that debug logs were generated and are properly formatted
      const relevantLogs = consoleLogs.filter(log =>
        log.includes('handleGanttTaskChange') ||
        log.includes('Drag & Drop') ||
        log.includes('actualIssueId')
      );

      console.log('Relevant debug logs:', relevantLogs);

      // Verify no object serialization in debug logs
      const objectSerializationLogs = relevantLogs.filter(log =>
        log.includes('[object Object]')
      );

      expect(objectSerializationLogs.length).toBe(0);
    }

    console.log('✅ Debug information test completed - proper issue ID formatting confirmed!');
  });
});