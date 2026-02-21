import type { Page, TestInfo } from '@playwright/test';

/**
 * Captures a screenshot and attaches it to the Playwright HTML report.
 * Name is used as the attachment label (spaces replaced with dashes).
 */
export async function takeScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const buffer = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body: buffer, contentType: 'image/png' });
}
