import { describe, expect, test } from 'bun:test';
import { getAuthCookies, hasAuth } from '../helpers/auth';
import { fetchPage } from '../helpers/fetch';

describe('Error handling — 404 page', () => {
  test('unknown route returns 404 or shows not-found text', async () => {
    const { status, $ } = await fetchPage('/nonexistent-page-xyz');
    const hasNotFoundText = $('body')
      .text()
      .match(/not found|404|page.*doesn.*exist/i);

    expect(status === 404 || !!hasNotFoundText).toBe(true);
  });
});

describe.skipIf(!hasAuth())('Error handling — Invalid portal sub-routes', () => {
  test('/owner/nonexistent redirects or shows 404', async () => {
    const cookies = await getAuthCookies('owner');
    const { status, $ } = await fetchPage('/owner/nonexistent', { cookies });

    const is404 = status === 404;
    const hasNotFound = $('body')
      .text()
      .match(/not found|404/i);
    const isRedirect = status >= 300 && status < 400;

    expect(is404 || !!hasNotFound || isRedirect).toBe(true);
  });

  test('/clinic/nonexistent redirects or shows 404', async () => {
    const cookies = await getAuthCookies('clinic');
    const { status, $ } = await fetchPage('/clinic/nonexistent', { cookies });

    const is404 = status === 404;
    const hasNotFound = $('body')
      .text()
      .match(/not found|404/i);
    const isRedirect = status >= 300 && status < 400;

    expect(is404 || !!hasNotFound || isRedirect).toBe(true);
  });

  test('/admin/nonexistent redirects or shows 404', async () => {
    const cookies = await getAuthCookies('admin');
    const { status, $ } = await fetchPage('/admin/nonexistent', { cookies });

    const is404 = status === 404;
    const hasNotFound = $('body')
      .text()
      .match(/not found|404/i);
    const isRedirect = status >= 300 && status < 400;

    expect(is404 || !!hasNotFound || isRedirect).toBe(true);
  });
});
