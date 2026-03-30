// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './crypto';

const TEST_KEY = 'a'.repeat(64);

beforeAll(() => {
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

describe('crypto', () => {
  it('encrypt then decrypt roundtrip returns original plaintext', () => {
    const plaintext = 'gho_super_secret_token_12345';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('decrypt with wrong key throws error', () => {
    const plaintext = 'test-token';
    const encrypted = encrypt(plaintext);
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decrypt(encrypted)).toThrow();
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  it('encrypted output is different from plaintext', () => {
    const plaintext = 'gho_another_token';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
  });

  it('each encryption produces different ciphertext (unique IV)', () => {
    const plaintext = 'same-input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });
});
