import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockOnCLS = mock();
const mockOnFCP = mock();
const mockOnINP = mock();
const mockOnLCP = mock();
const mockOnTTFB = mock();

mock.module('web-vitals', () => ({
  onCLS: mockOnCLS,
  onFCP: mockOnFCP,
  onINP: mockOnINP,
  onLCP: mockOnLCP,
  onTTFB: mockOnTTFB,
}));

const mockCapture = mock();

mock.module('posthog-js', () => ({
  default: {
    __loaded: true,
    capture: mockCapture,
  },
}));

const { reportWebVitals } = await import('../web-vitals');

// ── Helpers ──────────────────────────────────────────────────────────

/** Flush dynamic import() promise chains. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

// ── Tests ────────────────────────────────────────────────────────────

describe('reportWebVitals', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    // Simulate browser environment — reportWebVitals guards on window existence
    (globalThis as Record<string, unknown>).window = globalThis;
    (globalThis as Record<string, unknown>).location = { href: 'http://localhost:3000/test' };
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: must remove globalThis.window to restore non-browser env
    delete (globalThis as Record<string, unknown>).window;
    // biome-ignore lint/performance/noDelete: see above
    delete (globalThis as Record<string, unknown>).location;
    mockOnCLS.mockClear();
    mockOnFCP.mockClear();
    mockOnINP.mockClear();
    mockOnLCP.mockClear();
    mockOnTTFB.mockClear();
    mockCapture.mockClear();
  });

  it('registers all 5 web-vitals observers', async () => {
    reportWebVitals();
    await flush();

    expect(mockOnCLS).toHaveBeenCalledTimes(1);
    expect(mockOnFCP).toHaveBeenCalledTimes(1);
    expect(mockOnINP).toHaveBeenCalledTimes(1);
    expect(mockOnLCP).toHaveBeenCalledTimes(1);
    expect(mockOnTTFB).toHaveBeenCalledTimes(1);
  });

  it('sends correct event name and properties to posthog.capture', async () => {
    reportWebVitals();
    await flush();

    // Grab the callback registered with onLCP
    const lcpCallback = mockOnLCP.mock.calls[0][0] as (metric: unknown) => void;

    lcpCallback({
      name: 'LCP',
      value: 2500,
      rating: 'needs-improvement',
      delta: 2500,
      id: 'v4-1234',
      navigationType: 'navigate',
    });

    // posthog-js is lazy-imported inside the callback
    await flush();

    expect(mockCapture).toHaveBeenCalledWith('web_vital_captured', {
      metric_name: 'LCP',
      metric_value: 2500,
      metric_rating: 'needs-improvement',
      metric_delta: 2500,
      metric_id: 'v4-1234',
      navigation_type: 'navigate',
      page_url: 'http://localhost:3000/test',
    });
  });

  it('does not register observers when PostHog key is missing', async () => {
    // biome-ignore lint/performance/noDelete: must truly unset env vars
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    reportWebVitals();
    await flush();

    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnLCP).not.toHaveBeenCalled();
  });
});
