import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX = 'wsp_';

export function generateApiKey(): string {
  const raw = KEY_PREFIX + randomBytes(24).toString('hex');
  return raw;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function formatCreateKeyOutput(rawKey: string): string {
  const masked = rawKey.slice(0, 8) + '…' + rawKey.slice(-4);
  return `
╔══════════════════════════════════════════════════╗
║        NEW API KEY — SHOW ONCE, SAVE NOW        ║
╠══════════════════════════════════════════════════╣
║  Key:     ${rawKey.padEnd(38)}║
║  Masked:  ${masked.padEnd(38)}║
║  Hash:    ${hashApiKey(rawKey).slice(0, 16)}…${' '.repeat(22)}║
╚══════════════════════════════════════════════════╝

Store this key securely. It will NOT be shown again.
The database stores only the SHA-256 hash.
`;
}
