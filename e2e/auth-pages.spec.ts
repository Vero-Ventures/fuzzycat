import { expect, test } from '@playwright/test';

test.describe('Login page', () => {
  test('renders login form with all fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2').first()).toContainText(/log in/i);
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('has forgot password link', async ({ page }) => {
    await page.goto('/login');
    const forgotLink = page.getByRole('link', { name: /forgot your password/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/forgot-password');
  });

  test('has signup link', async ({ page }) => {
    await page.goto('/login');
    const signupLink = page.getByRole('link', { name: /sign up|create an account/i });
    await expect(signupLink).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('button[type="submit"]:not([disabled])');
    await page.fill('#email', 'nonexistent@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Wait for error message
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.text-destructive')).toContainText(/invalid|credentials|error/i);
  });

  test('shows loading state during submission', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('button[type="submit"]:not([disabled])');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'somepassword');
    await page.click('button[type="submit"]');
    // Button should show loading text
    await expect(page.getByRole('button', { name: /signing in/i })).toBeVisible();
  });

  test('email field has correct input type and autocomplete', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('password field has correct input type and autocomplete', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    await expect(passwordInput).toHaveAttribute('required', '');
  });
});

test.describe('Signup page', () => {
  test('renders signup form with tab selector', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: /pet owner/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /veterinary clinic/i })).toBeVisible();
  });

  test('pet owner tab shows correct fields', async ({ page }) => {
    await page.goto('/signup');
    // Pet Owner tab is default
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#petName')).toBeVisible();
  });

  test('clinic tab shows correct fields', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: /veterinary clinic/i }).click();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#clinicName')).toBeVisible();
    await expect(page.locator('#phone')).toBeVisible();
    await expect(page.locator('#addressState')).toBeVisible();
    await expect(page.locator('#addressZip')).toBeVisible();
  });

  test('tab switching toggles between owner and clinic fields', async ({ page }) => {
    await page.goto('/signup');

    // Default is pet owner - petName should be visible
    await expect(page.locator('#petName')).toBeVisible();
    await expect(page.locator('#clinicName')).not.toBeVisible();

    // Switch to clinic tab
    await page.getByRole('button', { name: /veterinary clinic/i }).click();
    await expect(page.locator('#clinicName')).toBeVisible();
    await expect(page.locator('#petName')).not.toBeVisible();

    // Switch back to owner tab
    await page.getByRole('button', { name: /pet owner/i }).click();
    await expect(page.locator('#petName')).toBeVisible();
    await expect(page.locator('#clinicName')).not.toBeVisible();
  });

  test('has login link', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.getByRole('link', { name: /log in|sign in|already have an account/i });
    await expect(loginLink).toBeVisible();
  });

  test('password field enforces minimum length', async ({ page }) => {
    await page.goto('/signup');
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('minlength', '8');
  });

  test('state field has maxlength of 2', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: /veterinary clinic/i }).click();
    await expect(page.locator('#addressState')).toHaveAttribute('maxlength', '2');
  });

  test('has create account button', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });
});

test.describe('Auth redirects', () => {
  test('unauthenticated user on /clinic/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/clinic/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('redirectTo');
  });

  test('unauthenticated user on /owner/payments redirects to /login', async ({ page }) => {
    await page.goto('/owner/payments');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated user on /admin/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });

  test('redirect preserves destination in query param', async ({ page }) => {
    await page.goto('/clinic/settings');
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get('redirectTo')).toBe('/clinic/settings');
  });

  test('redirect works for owner portal routes', async ({ page }) => {
    await page.goto('/owner/enroll');
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get('redirectTo')).toBe('/owner/enroll');
  });

  test('redirect works for admin portal routes', async ({ page }) => {
    await page.goto('/admin/risk');
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get('redirectTo')).toBe('/admin/risk');
  });
});
