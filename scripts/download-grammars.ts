import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { SUPPORTED_LANGUAGES } from '../src/lib/indexer/languages';

const WASM_DIR = resolve(__dirname, '..', 'wasm');
mkdirSync(WASM_DIR, { recursive: true });

const SOURCES = [
  resolve(__dirname, '..', 'node_modules', 'tree-sitter-wasm-prebuilt', 'lib'),
  resolve(__dirname, '..', 'node_modules', '@sourcegraph', 'tree-sitter-wasms', 'out'),
];

let copied = 0;
let missing = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  const dest = join(WASM_DIR, lang.grammarFile);

  if (existsSync(dest)) {
    console.log(`Already exists: ${lang.grammarFile}`);
    copied++;
    continue;
  }

  let found = false;
  for (const srcDir of SOURCES) {
    const src = join(srcDir, lang.grammarFile);
    if (existsSync(src)) {
      cpSync(src, dest);
      console.log(`Copied: ${lang.grammarFile}`);
      copied++;
      found = true;
      break;
    }
  }

  if (!found) {
    console.warn(`Not found in any source: ${lang.grammarFile} (${lang.name})`);
    missing++;
  }
}

const runtimeWasm = join(WASM_DIR, 'web-tree-sitter.wasm');
if (!existsSync(runtimeWasm)) {
  const runtimeSrc = resolve(__dirname, '..', 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm');
  if (existsSync(runtimeSrc)) {
    cpSync(runtimeSrc, runtimeWasm);
    console.log('Copied: web-tree-sitter.wasm (runtime)');
  } else {
    console.warn('web-tree-sitter.wasm not found in node_modules');
  }
} else {
  console.log('Already exists: web-tree-sitter.wasm (runtime)');
}

console.log(`\n${copied}/${SUPPORTED_LANGUAGES.length} grammar files ready.`);
if (missing > 0) {
  console.error(`${missing} grammar(s) missing. Install additional prebuilt packages or build from source.`);
  process.exit(1);
}
