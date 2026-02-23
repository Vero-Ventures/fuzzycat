import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

/**
 * Captures a screenshot, attaches it to the Playwright HTML report,
 * and writes it to the filesystem under e2e/screenshots/.
 */
export async function takeScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  subdir?: string,
) {
  const buffer = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body: buffer, contentType: 'image/png' });

  const screenshotsDir = path.resolve(__dirname, '..', 'screenshots');
  const dir = subdir ? path.join(screenshotsDir, subdir) : screenshotsDir;
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '')}.png`;
  fs.writeFileSync(path.join(dir, filename), buffer);
}
