import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES } from './languages';

describe('SUPPORTED_LANGUAGES', () => {
  it('has exactly 16 entries', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(16);
  });

  it('each entry has name, extensions, and grammarFile fields', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(lang).toHaveProperty('name');
      expect(lang).toHaveProperty('extensions');
      expect(lang).toHaveProperty('grammarFile');
      expect(typeof lang.name).toBe('string');
      expect(Array.isArray(lang.extensions)).toBe(true);
      expect(lang.extensions.length).toBeGreaterThan(0);
      expect(typeof lang.grammarFile).toBe('string');
      expect(lang.grammarFile).toMatch(/\.wasm$/);
    }
  });

  it('has no duplicate language names', () => {
    const names = SUPPORTED_LANGUAGES.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no duplicate grammar file names', () => {
    const files = SUPPORTED_LANGUAGES.map((l) => l.grammarFile);
    expect(new Set(files).size).toBe(files.length);
  });
});
