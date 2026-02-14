import { test, expect } from '@playwright/test';

/**
 * E2E tests for Antibiotic Stewardship
 * Critical user journey: Tracking antibiotic usage
 */

test.describe('Antibiotic Stewardship', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to antibiotic tracking', async ({ page }) => {
    await page.click('text=Antibiotics');
    await expect(page.locator('h1')).toContainText('Antibiotic');
  });

  test('should add new antibiotic entry', async ({ page }) => {
    await page.click('text=Antibiotics');
    await page.click('button:has-text("Add Entry")');
    
    // Fill antibiotic form
    await page.selectOption('select[name="residentId"]', { index: 1 });
    await page.fill('input[name="drugName"]', 'Amoxicillin');
    await page.fill('input[name="startDate"]', '2024-02-01');
    await page.fill('input[name="indication"]', 'UTI');
    await page.selectOption('select[name="route"]', 'oral');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Entry added successfully')).toBeVisible();
  });

  test('should display AUR metrics', async ({ page }) => {
    await page.click('text=Antibiotics');
    await page.click('text=Metrics');
    
    // Check if AUR is displayed
    await expect(page.locator('text=Antibiotic Utilization Rate')).toBeVisible();
    await expect(page.locator('[data-testid="aur-value"]')).toBeVisible();
  });

  test('should filter antibiotic entries by date range', async ({ page }) => {
    await page.click('text=Antibiotics');
    
    await page.fill('input[name="startDate"]', '2024-01-01');
    await page.fill('input[name="endDate"]', '2024-01-31');
    await page.click('button:has-text("Filter")');
    
    // Verify filtered results
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
  });
});
