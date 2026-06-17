import { describe, it, expect } from 'vitest';
import { categorizeError } from '../src/services/worker';
import { ProxyUnreachableError } from '../src/services/scraper';

describe('categorizeError', () => {
  it('returns 502 for ProxyUnreachableError', () => {
    const err = new ProxyUnreachableError('socks5://127.0.0.1:1080');
    const result = categorizeError(err);
    expect(result.statusCode).toBe(502);
    expect(result.message).toContain('SOCKS5 Proxy onbereikbaar');
  });

  it('returns 504 for timeout errors', () => {
    const err = new Error('navigation timeout exceeded');
    const result = categorizeError(err);
    expect(result.statusCode).toBe(504);
    expect(result.message).toBe('Request timed out while scraping the URL');
  });

  it('returns 500 for unknown errors', () => {
    const err = new Error('something went wrong');
    const result = categorizeError(err);
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('something went wrong');
  });

  it('handles non-Error objects', () => {
    const result = categorizeError('string error');
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('Unknown error');
  });

  it('returns 500 for null', () => {
    const result = categorizeError(null);
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe('Unknown error');
  });
});
