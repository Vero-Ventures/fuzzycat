import { mergeTests } from '@playwright/test';
import { test as authTest } from './auth.fixture';
import { test as loggingTest } from './logging.fixture';
import { test as mocksTest } from './mocks.fixture';
import { test as screenshotsTest } from './screenshots.fixture';

/**
 * Combined test fixture that includes all custom fixtures:
 * - Auth: ownerPage, clinicPage, adminPage
 * - Mocks: mockStripe, mockPlaid, mockTurnstile, mockAnalytics, mockAllExternal
 * - Screenshots: takeScreenshot
 * - Logging: consoleErrors, networkFailures, responseErrors, attachLogs
 */
export const test = mergeTests(authTest, mocksTest, screenshotsTest, loggingTest);

export { expect } from '@playwright/test';
