import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTree = { rootNode: { type: 'program' }, delete: vi.fn() };
const mockInit = vi.fn(() => Promise.resolve());
const mockLanguageLoad = vi.fn(() => Promise.resolve({ name: 'typescript' }));

class MockParser {
  static init = mockInit;
  setLanguage = vi.fn();
  parse = vi.fn(() => mockTree);
  delete = vi.fn();
}

vi.mock('web-tree-sitter', () => ({
  Parser: MockParser,
  Language: { load: mockLanguageLoad },
}));

describe('parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initTreeSitter', () => {
    it('calls Parser.init()', async () => {
      vi.resetModules();
      const { initTreeSitter } = await import('./parser');
      await initTreeSitter();
      expect(mockInit).toHaveBeenCalled();
    });
  });

  describe('getLanguage', () => {
    it('returns a cached language on second call (single load)', async () => {
      vi.resetModules();
      const { getLanguage, initTreeSitter } = await import('./parser');
      await initTreeSitter();
      await getLanguage('typescript');
      await getLanguage('typescript');
      expect(mockLanguageLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseCode', () => {
    it('returns a tree object for valid input', async () => {
      vi.resetModules();
      const { parseCode } = await import('./parser');
      const tree = await parseCode('const x = 1', 'typescript');
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe('program');
    });
  });
});
