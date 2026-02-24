import * as cheerio from 'cheerio';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

interface FetchPageOptions {
  cookies?: string;
  followRedirects?: boolean;
}

interface FetchPageResult {
  status: number;
  headers: Headers;
  redirectUrl: string | null;
  html: string;
  $: cheerio.CheerioAPI;
}

export async function fetchPage(
  path: string,
  options: FetchPageOptions = {},
): Promise<FetchPageResult> {
  const { cookies, followRedirects = false } = options;

  const headers: Record<string, string> = {};
  if (cookies) {
    headers.Cookie = cookies;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: followRedirects ? 'follow' : 'manual',
    headers,
  });

  const redirectUrl = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;

  const html = res.status >= 300 && res.status < 400 ? '' : await res.text();
  const $ = cheerio.load(html);

  return { status: res.status, headers: res.headers, redirectUrl, html, $ };
}
