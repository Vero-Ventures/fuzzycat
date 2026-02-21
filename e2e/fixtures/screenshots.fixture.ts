import { test as base } from '@playwright/test';
import { takeScreenshot as screenshotHelper } from '../helpers/screenshot';

export const test = base.extend<{
  takeScreenshot: (name: string) => Promise<void>;
}>({
  takeScreenshot: async ({ page }, use, testInfo) => {
    const fn = (name: string) => screenshotHelper(page, testInfo, name);
    await use(fn);
  },
});
