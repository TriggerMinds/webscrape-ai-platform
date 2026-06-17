import { describe, it, expect } from 'vitest';

// Inline test of the sanitizeUrl logic from scraper
function sanitizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

describe('sanitizeUrl', () => {
  it('adds https:// when missing', () => {
    expect(sanitizeUrl('example.com')).toBe('https://example.com');
  });

  it('preserves http://', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('preserves https://', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('trims whitespace', () => {
    expect(sanitizeUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('adds https:// when only domain with path', () => {
    expect(sanitizeUrl('example.com/page?q=1')).toBe('https://example.com/page?q=1');
  });
});
