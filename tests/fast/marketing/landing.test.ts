import { describe, expect, test } from 'bun:test';
import { CLINIC_SHARE_PERCENT } from '@/lib/constants';
import { fetchPage } from '../helpers/fetch';

describe('Landing page /', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/');
    expect(status).toBe(200);
  });

  test('hero heading and badge', async () => {
    const { $ } = await fetchPage('/');
    expect($('h1').text()).toContain('Making Pet Care');
    expect($('h1').text()).toContain('Affordable');
    expect($('body').text()).toContain('No credit check required');
  });

  test('hero CTAs link to correct pages', async () => {
    const { $ } = await fetchPage('/');
    expect($('a:contains("Log In")').attr('href')).toBe('/login');
    expect($('a:contains("Learn More")').first().attr('href')).toBe('/how-it-works');
  });

  test('three "how it works" steps', async () => {
    const { $ } = await fetchPage('/');
    const text = $('body').text();
    expect(text).toContain('Enroll online');
    expect(text).toContain('Automatic payments');
    expect(text).toContain('Done in 12 weeks');
  });

  test('transparent pricing cards', async () => {
    const { $ } = await fetchPage('/');
    const text = $('body').text();
    expect(text).toContain('No Interest');
    expect(text).toContain('No Credit Check');
    expect(text).toContain('12-Week Plans');
  });

  test(`clinic section with ${CLINIC_SHARE_PERCENT}% revenue share`, async () => {
    const { $ } = await fetchPage('/');
    const text = $('body').text();
    expect(text).toContain('For Veterinary Clinics');
    expect(text).toContain('Get paid to offer payment plans');
    expect(text).toContain(`Earn ${CLINIC_SHARE_PERCENT}% on every plan`);
    expect(text).toContain('Built-in default protection');
    expect(text).toContain('Zero setup cost');
    expect(text).toContain('Partner With FuzzyCat');
  });

  test('header nav links', async () => {
    const { $ } = await fetchPage('/');
    const headerLinks = $('header a')
      .toArray()
      .map((el) => ({
        href: $(el).attr('href'),
        text: $(el).text().trim(),
      }));
    const hrefs = headerLinks.map((l) => l.href);
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/how-it-works');
    expect(hrefs).toContain('/login');
  });

  test('footer sections and copyright', async () => {
    const { $ } = await fetchPage('/');
    const footerText = $('footer').text();
    expect(footerText).toContain('Clients');
    expect(footerText).toContain('Veterinary Clinics');
    expect(footerText).toContain('FuzzyCat. All rights reserved');
    expect(footerText).toContain('Not a lender');
  });
});
