import { test, expect } from '@playwright/test';

/**
 * E2E tests for Resident Management
 * Critical user journey: Creating and managing residents
 */

test.describe('Resident Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display resident management page', async ({ page }) => {
    // Navigate to residents page
    await page.click('text=Residents');
    
    // Check if the page loaded correctly
    await expect(page.locator('h1')).toContainText('Residents');
  });

  test('should create a new resident', async ({ page }) => {
    // Navigate to residents page
    await page.click('text=Residents');
    
    // Click add new resident button
    await page.click('button:has-text("Add Resident")');
    
    // Fill in the form
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="dateOfBirth"]', '1950-01-15');
    await page.fill('input[name="admissionDate"]', '2024-01-01');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify success message or redirect
    await expect(page.locator('text=Resident created successfully')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should search for residents', async ({ page }) => {
    // Navigate to residents page
    await page.click('text=Residents');
    
    // Enter search term
    await page.fill('input[placeholder*="Search"]', 'Doe');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Verify results are filtered
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test('should edit resident information', async ({ page }) => {
    // Navigate to residents page
    await page.click('text=Residents');
    
    // Click on first resident edit button
    await page.click('button[aria-label="Edit resident"]:first-of-type');
    
    // Update information
    await page.fill('input[name="unit"]', 'Unit B');
    
    // Save changes
    await page.click('button:has-text("Save")');
    
    // Verify update
    await expect(page.locator('text=Resident updated successfully')).toBeVisible();
  });

  test('should handle validation errors', async ({ page }) => {
    // Navigate to residents page
    await page.click('text=Residents');
    
    // Click add new resident
    await page.click('button:has-text("Add Resident")');
    
    // Try to submit without filling required fields
    await page.click('button[type="submit"]');
    
    // Check for validation errors
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Last name is required')).toBeVisible();
  });
});
