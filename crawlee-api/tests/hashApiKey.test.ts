import { describe, it, expect } from 'vitest';
import { hashApiKey, generateApiKey } from '../src/services/crypto';

describe('hashApiKey', () => {
  it('returns a deterministic 64-char hex string', () => {
    const hash = hashApiKey('wsp_test_key_123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different keys', () => {
    const hash1 = hashApiKey('wsp_key_one');
    const hash2 = hashApiKey('wsp_key_two');
    expect(hash1).not.toBe(hash2);
  });

  it('is deterministic for the same input', () => {
    const hash1 = hashApiKey('wsp_same_key');
    const hash2 = hashApiKey('wsp_same_key');
    expect(hash1).toBe(hash2);
  });
});

describe('generateApiKey', () => {
  it('starts with wsp_', () => {
    const key = generateApiKey();
    expect(key.startsWith('wsp_')).toBe(true);
  });

  it('generates unique keys', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });

  it('has reasonable length', () => {
    const key = generateApiKey();
    expect(key.length).toBeGreaterThan(20);
    expect(key.length).toBeLessThan(80);
  });
});
