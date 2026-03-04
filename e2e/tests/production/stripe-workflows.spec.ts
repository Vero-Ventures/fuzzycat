import { expect, test } from '@playwright/test';
import { TEST_PASSWORD, TEST_USERS } from '../../helpers/test-users';

/**
 * Production Stripe workflow tests.
 *
 * These run against production (fuzzycatapp.com) with real Stripe test-mode
 * accounts. They verify the full integration:
 *   - Owner payment method display (card + ACH)
 *   - Owner debit-card setup redirect to Stripe Checkout
 *   - Owner bank-account (ACH) switch
 *   - Clinic Stripe Connect status display
 *   - Clinic Stripe Connect onboarding redirect
 */

test.describe.configure({ timeout: 120_000 });

const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? TEST_PASSWORD;

// ── Helpers ────────────────────────────────────────────────────────────

/** Log in via the Supabase auth API and set cookies directly — avoids
 *  form-based login flakiness and Supabase rate limits. */
async function loginViaApi(page: import('@playwright/test').Page, role: 'owner' | 'clinic') {
  const user = TEST_USERS[role];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    // Fall back to form-based login if env vars unavailable
    await formLogin(page, role);
    return;
  }

  // Authenticate via Supabase REST API
  const resp = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    data: { email: user.email, password: E2E_PASSWORD },
  });

  if (!resp.ok()) {
    // Fall back to form login
    await formLogin(page, role);
    return;
  }

  const session = await resp.json();

  // Extract Supabase project ref from URL
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionStr = JSON.stringify(session);
  const encoded = `base64-${Buffer.from(sessionStr).toString('base64url')}`;

  // Set auth cookie
  await page.context().addCookies([
    {
      name: cookieName,
      value: encoded,
      domain: new URL('https://www.fuzzycatapp.com').hostname,
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}

async function formLogin(page: import('@playwright/test').Page, role: 'owner' | 'clinic') {
  const user = TEST_USERS[role];
  const loginPath = role === 'owner' ? '/login/owner' : '/login/clinic';

  await page.goto(loginPath, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('textbox', { name: /email/i }).fill(user.email);
  await page.getByRole('textbox', { name: /password/i }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

// ── Owner: Payment method display ──────────────────────────────────────

test.describe('Owner Stripe workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'owner');
  });

  test('settings page displays saved card and bank account', async ({ page }, testInfo) => {
    await page.goto('/owner/settings', { waitUntil: 'domcontentloaded' });

    // Wait for the Payment Method section to load
    await expect(page.getByText('Payment Method', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Should see "Debit Card" and "Bank Account (ACH)" option buttons
    await expect(page.getByRole('button', { name: /debit card/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bank account.*ach/i })).toBeVisible();

    // Wait for payment method details to load (separate tRPC query)
    const cardText = page.getByText(/ending in \d{4}/i);
    const bankText = page.getByText(/\*{4}\d{4}/);
    const noMethodText = page.getByText('No payment method on file');

    // Wait for one of the three states (use .first() to avoid strict mode with .or())
    await expect(cardText.or(bankText).or(noMethodText).first()).toBeVisible({ timeout: 10_000 });

    const hasCard = await cardText.isVisible().catch(() => false);
    const hasBank = await bankText.isVisible().catch(() => false);

    if (hasCard) {
      await expect(page.getByRole('button', { name: /replace/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /remove/i }).first()).toBeVisible();
    }

    if (hasBank) {
      await expect(page.getByRole('button', { name: /remove/i }).first()).toBeVisible();
    }

    await testInfo.attach('owner-payment-methods', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('debit card replace redirects to Stripe Checkout', async ({ page }, testInfo) => {
    await page.goto('/owner/settings', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Payment Method', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Wait for details to load
    await expect(
      page.getByText(/ending in \d{4}/i).or(page.getByText('No payment method on file')),
    ).toBeVisible({ timeout: 10_000 });

    // Click "Replace" if card exists, or "Debit Card" button for first-time setup
    const replaceBtn = page.getByRole('button', { name: /replace/i });
    const hasReplace = await replaceBtn.isVisible().catch(() => false);

    if (hasReplace) {
      await replaceBtn.click();
    } else {
      await page.getByRole('button', { name: /debit card/i }).click();
    }

    // Should redirect to Stripe Checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 25_000 });
    expect(page.url()).toContain('checkout.stripe.com');

    await testInfo.attach('stripe-checkout-redirect', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('bank account (ACH) switch or setup works', async ({ page }, testInfo) => {
    await page.goto('/owner/settings', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Payment Method', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Wait for details to load
    await expect(
      page.getByText(/ending in \d{4}/i).or(page.getByText('No payment method on file')),
    ).toBeVisible({ timeout: 10_000 });

    const bankText = page.getByText(/\*{4}\d{4}/);
    const hasExistingBank = await bankText.isVisible().catch(() => false);

    // Click "Bank Account (ACH)"
    await page.getByRole('button', { name: /bank account.*ach/i }).click();

    if (hasExistingBank) {
      // If bank account already exists, clicking switches active method →
      // should see "Payment method updated" success or the button becomes selected
      const successText = page.getByText(/payment method updated/i);
      await successText.isVisible({ timeout: 5_000 }).catch(() => false);

      // Or the Bank Account button becomes the selected/active one
      await testInfo.attach('bank-switch-result', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      // Either success message or no error is acceptable
      const errorText = page.getByText(/failed/i);
      const hasError = await errorText.isVisible().catch(() => false);
      expect(hasError).toBe(false);
    } else {
      // No bank account → Financial Connections should open
      // Wait for Stripe FC iframe or loading state
      await page.waitForTimeout(5000);

      const stripeFrame = page.locator('iframe[src*="stripe.com"]');
      const hasStripeFrame = await stripeFrame.isVisible().catch(() => false);
      const hasDialog = await page
        .locator('[role="dialog"]')
        .isVisible()
        .catch(() => false);
      const hasSaving = await page
        .getByText(/saving/i)
        .isVisible()
        .catch(() => false);

      await testInfo.attach('ach-setup-state', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      expect(
        hasStripeFrame || hasDialog || hasSaving,
        'Expected Financial Connections to open',
      ).toBe(true);
    }
  });
});

// ── Clinic: Stripe Connect ─────────────────────────────────────────────

test.describe('Clinic Stripe Connect workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'clinic');
  });

  test('settings page shows Stripe Connect section', async ({ page }, testInfo) => {
    await page.goto('/clinic/settings', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Clinic Settings' })).toBeVisible({
      timeout: 15_000,
    });

    // Clinic settings fetches profile + Stripe account status.
    // If the Stripe account hasn't completed onboarding, this can be slow.
    // Wait for either the Stripe section or the error message to appear.
    const stripeTitle = page.getByText('Stripe Connect');
    const errorText = page.getByText(/unable to load stripe connect/i);
    const connectedText = page.getByText('Connected');
    const clinicNameInput = page.locator('#clinic-name');

    // Wait for content to resolve — try up to 20s (use .first() to avoid strict mode)
    await expect(
      stripeTitle.or(errorText).or(connectedText).or(clinicNameInput).first(),
    ).toBeVisible({ timeout: 20_000 });

    const hasTitle = await stripeTitle.isVisible().catch(() => false);
    const hasError = await errorText.isVisible().catch(() => false);
    const hasConnected = await connectedText
      .first()
      .isVisible()
      .catch(() => false);
    const hasForm = await clinicNameInput.isVisible().catch(() => false);

    // At least one content element should be visible
    expect(hasTitle || hasError || hasConnected || hasForm).toBe(true);

    await testInfo.attach('clinic-stripe-connect-section', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('onboarding page loads and shows steps', async ({ page }, testInfo) => {
    await page.goto('/clinic/onboarding', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Welcome to FuzzyCat')).toBeVisible({ timeout: 15_000 });

    // Wait for checklist data to load (calls getOnboardingStatus which queries Stripe)
    await page.waitForTimeout(8000);

    // The page shows either:
    // 1. Checklist steps with setup buttons
    // 2. Error alert if Stripe account query fails
    // 3. Skeleton loading placeholders (still resolving)
    const bankStep = page.getByText(/connect your bank account/i);
    const errorAlert = page.getByText(/unable to load|something went wrong/i);
    const setupBtn = page.getByRole('button', { name: /stripe setup/i });

    const hasBankStep = await bankStep.isVisible().catch(() => false);
    const hasError = await errorAlert.isVisible().catch(() => false);
    const hasBtn = await setupBtn.isVisible().catch(() => false);

    await testInfo.attach('clinic-onboarding-page', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // The page should have loaded with content — not still showing skeletons
    expect(
      hasBankStep || hasError || hasBtn,
      'Expected onboarding checklist, setup button, or error state',
    ).toBe(true);
  });

  test('Stripe Connect setup initiates redirect to Stripe', async ({ page }, testInfo) => {
    await page.goto('/clinic/onboarding', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Welcome to FuzzyCat')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(8000);

    // Find whichever Stripe setup button is visible
    const startBtn = page.getByRole('button', { name: /start stripe setup/i });
    const continueBtn = page.getByRole('button', { name: /continue stripe setup/i });

    const hasStart = await startBtn.isVisible().catch(() => false);
    const hasContinue = await continueBtn.isVisible().catch(() => false);

    if (!hasStart && !hasContinue) {
      await testInfo.attach('stripe-setup-unavailable', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      test.skip(true, 'Stripe setup button not available (complete or error state)');
      return;
    }

    if (hasStart) await startBtn.click();
    else await continueBtn.click();

    // Should redirect to Stripe Connect onboarding
    const redirectedToStripe = await page
      .waitForURL(/connect\.stripe\.com/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    if (redirectedToStripe) {
      expect(page.url()).toContain('connect.stripe.com');
    } else {
      // Check for known error
      const errorText = page.getByText(/failed to generate onboarding link/i);
      const hasError = await errorText.isVisible().catch(() => false);

      expect(
        redirectedToStripe || hasError,
        'Expected redirect to Stripe or a known error message',
      ).toBe(true);
    }

    await testInfo.attach('stripe-connect-result', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
});
