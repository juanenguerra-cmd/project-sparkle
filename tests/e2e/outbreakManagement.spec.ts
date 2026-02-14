import { test, expect } from '@playwright/test';

/**
 * E2E tests for Outbreak Management
 * Critical user journey: Managing infection outbreaks
 */

test.describe('Outbreak Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create new outbreak', async ({ page }) => {
    await page.click('text=Outbreaks');
    await page.click('button:has-text("New Outbreak")');
    
    await page.selectOption('select[name="type"]', 'respiratory');
    await page.fill('input[name="startDate"]', '2024-02-01');
    await page.fill('textarea[name="description"]', 'Respiratory outbreak in Unit A');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Outbreak created successfully')).toBeVisible();
  });

  test('should add residents to outbreak', async ({ page }) => {
    await page.click('text=Outbreaks');
    await page.click('table tbody tr:first-child');
    
    await page.click('button:has-text("Add Resident")');
    await page.selectOption('select[name="residentId"]', { index: 1 });
    await page.click('button:has-text("Add")');
    
    await expect(page.locator('text=Resident added to outbreak')).toBeVisible();
  });

  test('should display outbreak metrics', async ({ page }) => {
    await page.click('text=Outbreaks');
    await page.click('table tbody tr:first-child');
    
    await expect(page.locator('text=Affected Residents')).toBeVisible();
    await expect(page.locator('[data-testid="affected-count"]')).toBeVisible();
  });

  test('should close outbreak', async ({ page }) => {
    await page.click('text=Outbreaks');
    await page.click('table tbody tr:first-child');
    
    await page.click('button:has-text("Close Outbreak")');
    await page.fill('input[name="endDate"]', '2024-02-15');
    await page.click('button:has-text("Confirm")');
    
    await expect(page.locator('text=Outbreak closed')).toBeVisible();
  });
});
