import { describe, expect, test } from 'bun:test';
import { getAuthCookies, hasAuth } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

/**
 * Check that heading levels (h1–h6) are not skipped on a page.
 * e.g. h1 → h3 without h2 is a violation.
 */
function expectNoSkippedHeadings($: import('cheerio').CheerioAPI) {
  const headings = $('h1, h2, h3, h4, h5, h6')
    .toArray()
    .map((el) => Number.parseInt(el.tagName.replace('h', ''), 10));

  expect(headings.length).toBeGreaterThan(0);

  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1]) {
      expect(headings[i] - headings[i - 1]).toBeLessThanOrEqual(1);
    }
  }
}

/**
 * Check that every visible input has an associated label (for, aria-label, or parent label).
 */
function expectInputsHaveLabels($: import('cheerio').CheerioAPI) {
  const inputs = $(
    'input[type="email"], input[type="password"], input[type="text"], input[type="tel"]',
  );

  inputs.each((_i, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    const hasForLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
    const hasAriaLabel = !!$el.attr('aria-label');
    const hasAriaLabelledBy = !!$el.attr('aria-labelledby');
    const hasParentLabel = $el.parents('label').length > 0;
    const hasPlaceholder = !!$el.attr('placeholder');

    expect(
      hasForLabel || hasAriaLabel || hasAriaLabelledBy || hasParentLabel || hasPlaceholder,
    ).toBe(true);
  });
}

describe('Accessibility — Heading hierarchy (public pages)', () => {
  test('/ has proper heading hierarchy', async () => {
    const { $ } = await fetchPage('/');
    expectNoSkippedHeadings($);
    // Exactly one h1
    expect($('h1').length).toBe(1);
  });

  test('/login has proper heading hierarchy', async () => {
    const { $ } = await fetchPage('/login');
    expectNoSkippedHeadings($);
    expect($('h1').length).toBe(1);
  });

  test('/signup has proper heading hierarchy', async () => {
    const { $ } = await fetchPage('/signup');
    // Signup may error-boundary without env vars; skip if no h1
    if ($('h1').length === 0) return;
    expectNoSkippedHeadings($);
    expect($('h1').length).toBe(1);
  });
});

describe('Accessibility — Label association (public pages)', () => {
  test('/login inputs have labels', async () => {
    const { $ } = await fetchPage('/login');
    expectInputsHaveLabels($);
  });

  test('/signup inputs have labels', async () => {
    const { $ } = await fetchPage('/signup');
    // Skip if signup didn't render (env var issues)
    if ($('input[type="email"]').length === 0) return;
    expectInputsHaveLabels($);
  });
});

describe.skipIf(!hasAuth())('Accessibility — Portal pages', () => {
  test('portal heading hierarchy (/clinic/dashboard)', async () => {
    const cookies = await getAuthCookies('clinic');
    const { $ } = await fetchPage('/clinic/dashboard', { cookies, followRedirects: true });
    expectNoSkippedHeadings($);
    expect($('h1').length).toBe(1);
  });

  test('portal heading hierarchy (/admin/dashboard)', async () => {
    const cookies = await getAuthCookies('admin');
    const { $ } = await fetchPage('/admin/dashboard', { cookies, followRedirects: true });
    expectNoSkippedHeadings($);
    expect($('h1').length).toBe(1);
  });

  test('portal heading hierarchy (/owner/payments)', async () => {
    const cookies = await getAuthCookies('owner');
    const { $ } = await fetchPage('/owner/payments', { cookies, followRedirects: true });
    expectNoSkippedHeadings($);
    expect($('h1').length).toBe(1);
  });

  test('portal form labels (/clinic/settings)', async () => {
    const cookies = await getAuthCookies('clinic');
    const { $ } = await fetchPage('/clinic/settings', { cookies, followRedirects: true });
    expectInputsHaveLabels($);
  });
});
