import path from 'path';
import { Parser, Language, type Tree } from 'web-tree-sitter';

let initialized = false;
const languageCache = new Map<string, Language>();

function wasmDir(): string {
  return path.resolve(process.cwd(), 'wasm');
}

export async function initTreeSitter() {
  if (initialized) return;
  await Parser.init({
    locateFile(scriptName: string) {
      return path.join(wasmDir(), scriptName);
    },
  });
  initialized = true;
}

export async function getLanguage(name: string): Promise<Language> {
  const cached = languageCache.get(name);
  if (cached) return cached;

  const wasmPath = path.join(wasmDir(), `tree-sitter-${name}.wasm`);
  const language = await Language.load(wasmPath);
  languageCache.set(name, language);
  return language;
}

export async function parseCode(code: string, language: string): Promise<Tree> {
  await initTreeSitter();
  const lang = await getLanguage(language);
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  parser.delete();
  if (!tree) throw new Error(`Failed to parse code with language: ${language}`);
  return tree;
}
