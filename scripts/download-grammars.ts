import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { SUPPORTED_LANGUAGES } from '../src/lib/indexer/languages';

const WASM_DIR = resolve(__dirname, '..', 'wasm');
mkdirSync(WASM_DIR, { recursive: true });

const NAME_TO_PACKAGE: Record<string, string> = {
  javascript: 'tree-sitter-javascript-wasm',
  typescript: 'tree-sitter-typescript-wasm',
  python: 'tree-sitter-python-wasm',
  go: 'tree-sitter-go-wasm',
  rust: 'tree-sitter-rust-wasm',
  java: 'tree-sitter-java-wasm',
  ruby: 'tree-sitter-ruby-wasm',
  c: 'tree-sitter-c-wasm',
  cpp: 'tree-sitter-cpp-wasm',
  c_sharp: 'tree-sitter-c-sharp-wasm',
  php: 'tree-sitter-php-wasm',
  swift: 'tree-sitter-swift-wasm',
  kotlin: 'tree-sitter-kotlin-wasm',
  scala: 'tree-sitter-scala-wasm',
  html: 'tree-sitter-html-wasm',
  css: 'tree-sitter-css-wasm',
};

let missing = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  const pkgName = NAME_TO_PACKAGE[lang.name];
  if (!pkgName) {
    console.error(`No package mapping for language: ${lang.name}`);
    missing++;
    continue;
  }

  const pkgDir = resolve(__dirname, '..', 'node_modules', '@tree-sitter-grammars', pkgName);
  if (!existsSync(pkgDir)) {
    console.error(`Package not installed: @tree-sitter-grammars/${pkgName}`);
    missing++;
    continue;
  }

  const wasmFiles = [lang.grammarFile];
  for (const wasmFile of wasmFiles) {
    const src = join(pkgDir, wasmFile);
    const dest = join(WASM_DIR, wasmFile);

    if (!existsSync(src)) {
      const altSrc = join(pkgDir, 'dist', wasmFile);
      if (existsSync(altSrc)) {
        cpSync(altSrc, dest);
        console.log(`Copied ${wasmFile} (from dist/)`);
        continue;
      }
      console.error(`WASM file not found: ${src}`);
      missing++;
      continue;
    }

    cpSync(src, dest);
    console.log(`Copied ${wasmFile}`);
  }
}

if (missing > 0) {
  console.error(`\n${missing} grammar file(s) could not be copied.`);
  console.error('Install grammar packages: npm install -D @tree-sitter-grammars/tree-sitter-<lang>-wasm');
  process.exit(1);
}

console.log(`\nAll ${SUPPORTED_LANGUAGES.length} grammar files copied to wasm/`);
