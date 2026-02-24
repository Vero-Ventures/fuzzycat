import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('Landing page /', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/');
    expect(status).toBe(200);
  });

  test('hero heading and badge', async () => {
    const { $ } = await fetchPage('/');
    expect($('h1').text()).toContain('Your pet deserves care');
    expect($('h1').text()).toContain('You deserve a fair payment plan');
    expect($('body').text()).toContain('No credit check required');
  });

  test('hero CTAs link to correct pages', async () => {
    const { $ } = await fetchPage('/');
    expect($('a:contains("Start My Payment Plan")').attr('href')).toBe('/signup');
    expect($('a:contains("See How It Works")').attr('href')).toBe('/how-it-works');
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
    expect(text).toContain('Flat 6% Fee');
    expect(text).toContain('No Credit Check');
    expect(text).toContain('12-Week Plan');
  });

  test('clinic section with 3% revenue share', async () => {
    const { $ } = await fetchPage('/');
    const text = $('body').text();
    expect(text).toContain('For Veterinary Clinics');
    expect(text).toContain('Get paid to offer payment plans');
    expect(text).toContain('Earn 3% on every plan');
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
    expect(hrefs).toContain('/signup');
  });

  test('footer sections and copyright', async () => {
    const { $ } = await fetchPage('/');
    const footerText = $('footer').text();
    expect(footerText).toContain('Pet Owners');
    expect(footerText).toContain('Veterinary Clinics');
    expect(footerText).toContain('FuzzyCat. All rights reserved');
    expect(footerText).toContain('Not a lender');
  });
});
