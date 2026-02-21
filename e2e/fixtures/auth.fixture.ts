import { test as base, type Page } from '@playwright/test';
import { TEST_USERS } from '../helpers/test-users';

/** Fixtures providing pre-authenticated pages for each role. */
export const test = base.extend<{
  ownerPage: Page;
  clinicPage: Page;
  adminPage: Page;
}>({
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.owner.storageStatePath,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  clinicPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.clinic.storageStatePath,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.admin.storageStatePath,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
