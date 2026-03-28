import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { SUPPORTED_LANGUAGES } from '../src/lib/indexer/languages';

const WASM_DIR = resolve(__dirname, '..', 'wasm');
const PREBUILT_DIR = resolve(__dirname, '..', 'node_modules', 'tree-sitter-wasm-prebuilt', 'lib');

mkdirSync(WASM_DIR, { recursive: true });

let copied = 0;
let missing = 0;

for (const lang of SUPPORTED_LANGUAGES) {
  const dest = join(WASM_DIR, lang.grammarFile);
  const src = join(PREBUILT_DIR, lang.grammarFile);

  if (existsSync(dest)) {
    console.log(`Already exists: ${lang.grammarFile}`);
    copied++;
    continue;
  }

  if (existsSync(src)) {
    cpSync(src, dest);
    console.log(`Copied: ${lang.grammarFile}`);
    copied++;
  } else {
    console.warn(`Not available in prebuilt package: ${lang.grammarFile} (${lang.name})`);
    missing++;
  }
}

console.log(`\n${copied} grammar files ready, ${missing} unavailable.`);
if (missing > 0) {
  console.log('Missing grammars can be built from source or downloaded separately when needed.');
}
