import { describe, expect, test } from 'bun:test';
import { fetchPage } from '../helpers/fetch';

describe('How It Works /how-it-works', () => {
  test('returns 200', async () => {
    const { status } = await fetchPage('/how-it-works');
    expect(status).toBe(200);
  });

  test('page heading', async () => {
    const { $ } = await fetchPage('/how-it-works');
    expect($('h1').text()).toContain('How FuzzyCat Works');
  });

  test('pet owner steps (4)', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    expect(text).toContain('Visit your vet');
    expect(text).toContain('Enroll online');
    expect(text).toContain('Pay 25% deposit');
    expect(text).toContain('Biweekly payments');
  });

  test('what you pay section', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    expect(text).toContain('Flat 6% platform fee');
    expect(text).toContain('25% deposit up front');
    expect(text).toContain('6 biweekly installments');
    expect(text).toContain('No credit check');
  });

  test('payment calculator section', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    expect(text).toContain('Try the payment calculator');
    expect(text).toContain('No signup required');
  });

  test('clinic benefits (3 cards)', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    expect(text).toContain('Earn 3% on every enrollment');
    expect(text).toContain('Automated payment recovery');
    expect(text).toContain('Fast payouts');
  });

  test('clinic payouts steps', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    expect(text).toContain('Pet owner enrolls');
    expect(text).toContain('payment succeeds');
    expect(text).toContain('revenue share');
    expect(text).toContain('Track all plans');
  });

  test('FAQ questions (9)', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    const faqQuestions = [
      'What is FuzzyCat?',
      'Do you run a credit check?',
      'What fees do I pay?',
      'Is there a minimum bill amount?',
      'What payment methods are accepted?',
      'What happens if I miss a payment?',
      'What does it cost the clinic?',
      'What if a pet owner defaults?',
      'Which clinics accept FuzzyCat?',
    ];
    for (const q of faqQuestions) {
      expect(text).toContain(q);
    }
  });

  test('bottom CTAs with hrefs', async () => {
    const { $ } = await fetchPage('/how-it-works');
    const text = $('body').text();
    expect(text).toContain('Ready to get started?');
    expect($('a:contains("Sign Up as Pet Owner")').attr('href')).toBe('/signup');
    expect($('a:contains("Register Your Clinic")').attr('href')).toBe('/signup');
  });
});
