import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTree = { rootNode: { type: 'program' }, delete: vi.fn() };
const mockParser = {
  setLanguage: vi.fn(),
  parse: vi.fn(() => mockTree),
  delete: vi.fn(),
};
const MockParserClass = vi.fn(() => mockParser) as unknown as typeof import('web-tree-sitter').default;
(MockParserClass as Record<string, unknown>).init = vi.fn(() => Promise.resolve());
(MockParserClass as Record<string, unknown>).Language = {
  load: vi.fn(() => Promise.resolve({ name: 'typescript' })),
};

vi.mock('web-tree-sitter', () => ({ default: MockParserClass }));

describe('parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initTreeSitter', () => {
    it('calls Parser.init()', async () => {
      const mod = await import('./parser');
      await mod.initTreeSitter();
      expect((MockParserClass as Record<string, unknown>).init).toHaveBeenCalled();
    });
  });

  describe('getLanguage', () => {
    it('returns a cached language on second call (single load)', async () => {
      const mod = await import('./parser');
      await mod.initTreeSitter();
      await mod.getLanguage('typescript');
      await mod.getLanguage('typescript');
      expect(
        (MockParserClass as unknown as { Language: { load: ReturnType<typeof vi.fn> } }).Language
          .load,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseCode', () => {
    it('returns a tree object for valid input', async () => {
      const mod = await import('./parser');
      const tree = await mod.parseCode('const x = 1', 'typescript');
      expect(tree).toBeDefined();
      expect(tree.rootNode).toBeDefined();
      expect(tree.rootNode.type).toBe('program');
    });
  });
});
