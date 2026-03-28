export type SupportedLanguage = {
  name: string;
  extensions: string[];
  grammarFile: string;
};

export const SUPPORTED_LANGUAGES = [
  { name: 'javascript', extensions: ['.js', '.jsx', '.mjs'], grammarFile: 'tree-sitter-javascript.wasm' },
  { name: 'typescript', extensions: ['.ts', '.tsx'], grammarFile: 'tree-sitter-typescript.wasm' },
  { name: 'python', extensions: ['.py'], grammarFile: 'tree-sitter-python.wasm' },
  { name: 'go', extensions: ['.go'], grammarFile: 'tree-sitter-go.wasm' },
  { name: 'rust', extensions: ['.rs'], grammarFile: 'tree-sitter-rust.wasm' },
  { name: 'java', extensions: ['.java'], grammarFile: 'tree-sitter-java.wasm' },
  { name: 'ruby', extensions: ['.rb'], grammarFile: 'tree-sitter-ruby.wasm' },
  { name: 'c', extensions: ['.c', '.h'], grammarFile: 'tree-sitter-c.wasm' },
  { name: 'cpp', extensions: ['.cpp', '.cc', '.cxx', '.hpp'], grammarFile: 'tree-sitter-cpp.wasm' },
  { name: 'c_sharp', extensions: ['.cs'], grammarFile: 'tree-sitter-c_sharp.wasm' },
  { name: 'php', extensions: ['.php'], grammarFile: 'tree-sitter-php.wasm' },
  { name: 'swift', extensions: ['.swift'], grammarFile: 'tree-sitter-swift.wasm' },
  { name: 'kotlin', extensions: ['.kt', '.kts'], grammarFile: 'tree-sitter-kotlin.wasm' },
  { name: 'scala', extensions: ['.scala', '.sc'], grammarFile: 'tree-sitter-scala.wasm' },
  { name: 'html', extensions: ['.html', '.htm'], grammarFile: 'tree-sitter-html.wasm' },
  { name: 'css', extensions: ['.css'], grammarFile: 'tree-sitter-css.wasm' },
] as const satisfies readonly SupportedLanguage[];
