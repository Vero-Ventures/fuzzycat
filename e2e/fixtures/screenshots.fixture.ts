import { test as base } from '@playwright/test';
import { takeScreenshot as screenshotHelper } from '../helpers/screenshot';

export const test = base.extend<{
  takeScreenshot: (name: string, subdir?: string) => Promise<void>;
}>({
  takeScreenshot: async ({ page }, use, testInfo) => {
    const fn = (name: string, subdir?: string) => screenshotHelper(page, testInfo, name, subdir);
    await use(fn);
  },
});
