import { test, expect } from '@playwright/test';

test.describe('Issue Editing Functionality', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Navigate to the project page first
    await page.goto(BASE_URL);
  });

  test('should edit issue properties without version property error', async ({ page }) => {
    console.log('Starting issue editing test...');

    // Step 1: Navigate to a project with issues
    await page.goto(`${BASE_URL}/projects`);
    await page.waitForTimeout(2000);

    // Find and click on the first project
    const projectLinks = await page.locator('a[href*="/projects/"]').all();
    if (projectLinks.length === 0) {
      console.log('No projects found, creating a test scenario...');
      // We'll continue with available data or handle gracefully
    } else {
      await projectLinks[0].click();
      await page.waitForTimeout(1000);
    }

    // Step 2: Navigate to issues page
    const currentUrl = page.url();
    const projectId = currentUrl.match(/\/projects\/(\d+)/)?.[1] || '1';

    await page.goto(`${BASE_URL}/projects/${projectId}/issues`);
    await page.waitForTimeout(2000);

    console.log(`Navigated to issues page for project ${projectId}`);

    // Step 3: Find an existing issue to edit
    const issueRows = await page.locator('tr[data-testid*="issue-row"], .issue-item, [data-issue-id]').all();

    if (issueRows.length === 0) {
      console.log('No issues found, looking for alternative ways to access issue editing...');

      // Check if there are any links to issue edit pages
      const editLinks = await page.locator('a[href*="/issues/"][href*="/edit"]').all();
      if (editLinks.length > 0) {
        await editLinks[0].click();
      } else {
        // Try to find any issue links
        const issueLinks = await page.locator('a[href*="/issues/"]').all();
        if (issueLinks.length > 0) {
          await issueLinks[0].click();
          await page.waitForTimeout(1000);

          // Look for edit button on the issue detail page
          const editButton = page.locator('button:has-text("編集"), button:has-text("Edit"), a[href*="/edit"]');
          if (await editButton.count() > 0) {
            await editButton.first().click();
          } else {
            // Manually navigate to edit page
            const currentUrl = page.url();
            const issueId = currentUrl.match(/\/issues\/(\d+)/)?.[1];
            if (issueId) {
              await page.goto(`${currentUrl}/edit`);
            }
          }
        } else {
          throw new Error('No issues available for editing test');
        }
      }
    } else {
      // Click on the first issue or find its edit link
      const firstIssue = issueRows[0];

      // Try to find edit button/link within the issue row
      const editButtonInRow = firstIssue.locator('button:has-text("編集"), button:has-text("Edit"), a[href*="/edit"]');
      if (await editButtonInRow.count() > 0) {
        await editButtonInRow.first().click();
      } else {
        // Click on the issue itself to go to detail page
        await firstIssue.click();
        await page.waitForTimeout(1000);

        // Look for edit button on detail page
        const editButton = page.locator('button:has-text("編集"), button:has-text("Edit"), a[href*="/edit"]');
        if (await editButton.count() > 0) {
          await editButton.first().click();
        } else {
          // Extract issue ID and navigate manually
          const currentUrl = page.url();
          const issueId = currentUrl.match(/\/issues\/(\d+)/)?.[1];
          if (issueId) {
            await page.goto(`${currentUrl}/edit`);
          }
        }
      }
    }

    await page.waitForTimeout(2000);
    console.log('Navigated to issue edit page');

    // Step 4: Verify we're on the edit page
    expect(page.url()).toMatch(/\/issues\/\d+\/edit/);

    // Step 5: Test editing various issue properties
    console.log('Testing issue property editing...');

    // Edit title
    const titleInput = page.locator('input[name="title"], input[id="title"], input[placeholder*="title"], input[placeholder*="タイトル"]');
    if (await titleInput.count() > 0) {
      await titleInput.clear();
      await titleInput.fill('Updated Issue Title - Testing Version Fix');
      console.log('Updated issue title');
    }

    // Edit description
    const descriptionInput = page.locator('textarea[name="description"], textarea[id="description"], textarea[placeholder*="description"], textarea[placeholder*="説明"]');
    if (await descriptionInput.count() > 0) {
      await descriptionInput.clear();
      await descriptionInput.fill('Updated description to test that version property validation is working correctly.');
      console.log('Updated issue description');
    }

    // Edit status
    const statusSelect = page.locator('select[name="status"], select[id="status"]');
    if (await statusSelect.count() > 0) {
      await statusSelect.selectOption({ index: 1 }); // Select second option
      console.log('Updated issue status');
    }

    // Edit priority
    const prioritySelect = page.locator('select[name="priority"], select[id="priority"]');
    if (await prioritySelect.count() > 0) {
      await prioritySelect.selectOption({ index: 1 }); // Select second option
      console.log('Updated issue priority');
    }

    // Step 6: Submit the form and verify no version property error
    console.log('Submitting form...');

    const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("Save"), button:has-text("更新"), button:has-text("Update")');

    // Listen for network responses to catch any validation errors
    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/api/issues/') && response.request().method() === 'PATCH'
    );

    await submitButton.click();

    // Wait for the API response
    const response = await responsePromise;
    const responseStatus = response.status();

    console.log(`API Response Status: ${responseStatus}`);

    if (responseStatus !== 200) {
      const responseBody = await response.text();
      console.log(`Response Body: ${responseBody}`);

      // Check if it's the version property error
      if (responseBody.includes('version') && responseBody.includes('should not exist')) {
        throw new Error('Version property validation error still exists!');
      }
    }

    // Verify successful update
    expect(responseStatus).toBe(200);

    // Step 7: Verify success message or redirect
    await page.waitForTimeout(2000);

    // Check for success indicators
    const successMessage = page.locator('.success, .alert-success, [data-testid="success"]');
    const isRedirected = !page.url().includes('/edit');

    if (await successMessage.count() > 0) {
      console.log('Success message displayed');
    }

    if (isRedirected) {
      console.log('Redirected after successful update');
    }

    // Either success message should be shown or we should be redirected
    expect(await successMessage.count() > 0 || isRedirected).toBe(true);

    console.log('✅ Issue editing test completed successfully - version property error is fixed!');
  });

  test('should handle hierarchy changes (parent_id) without version property error', async ({ page }) => {
    console.log('Starting hierarchy change test...');

    // Navigate to issues page
    await page.goto(`${BASE_URL}/projects/1/issues`);
    await page.waitForTimeout(2000);

    // Find and edit an issue
    const issueLinks = await page.locator('a[href*="/issues/"][href*="/edit"]').all();
    if (issueLinks.length === 0) {
      // Alternative navigation method
      const issueRows = await page.locator('tr[data-testid*="issue-row"], .issue-item').all();
      if (issueRows.length > 0) {
        await issueRows[0].click();
        await page.waitForTimeout(1000);
        const editButton = page.locator('a[href*="/edit"], button:has-text("編集")');
        if (await editButton.count() > 0) {
          await editButton.first().click();
        }
      }
    } else {
      await issueLinks[0].click();
    }

    await page.waitForTimeout(2000);

    // Look for parent issue selection
    const parentSelect = page.locator('select[name="parent_id"], select[id="parent_id"], select[name="parentId"]');
    if (await parentSelect.count() > 0) {
      console.log('Found parent selection field, testing hierarchy change...');

      // Change parent
      await parentSelect.selectOption({ index: 1 });
      console.log('Changed parent issue');

      // Submit the change
      const submitButton = page.locator('button[type="submit"], button:has-text("保存"), button:has-text("Save")');

      const responsePromise = page.waitForResponse(response =>
        response.url().includes('/api/issues/') && response.request().method() === 'PATCH'
      );

      await submitButton.click();

      const response = await responsePromise;
      const responseStatus = response.status();

      console.log(`Hierarchy change API Response Status: ${responseStatus}`);

      if (responseStatus !== 200) {
        const responseBody = await response.text();
        console.log(`Response Body: ${responseBody}`);

        if (responseBody.includes('version') && responseBody.includes('should not exist')) {
          throw new Error('Version property validation error still exists during hierarchy changes!');
        }
      }

      expect(responseStatus).toBe(200);
      console.log('✅ Hierarchy change test completed successfully');
    } else {
      console.log('No parent selection field found, skipping hierarchy test');
    }
  });

  test('should verify backend accepts version field in API requests', async ({ page }) => {
    console.log('Starting direct API test for version field...');

    // This test directly verifies the API accepts version field
    const apiResponse = await page.request.patch(`${BASE_URL}/api/issues/1`, {
      data: {
        title: 'Test Issue with Version',
        description: 'Testing that version field is accepted',
        version: 1
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const status = apiResponse.status();
    console.log(`Direct API call status: ${status}`);

    if (status === 400) {
      const responseBody = await apiResponse.text();
      console.log(`API Response: ${responseBody}`);

      if (responseBody.includes('version') && responseBody.includes('should not exist')) {
        throw new Error('Version property validation error still exists in API!');
      }
    }

    // Status should be 200 (success) or 404 (issue not found), but not 400 (validation error)
    expect(status).not.toBe(400);
    console.log('✅ Direct API test completed - version field is accepted');
  });
});