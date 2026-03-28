/**
 * Indexer module: AST-based code chunking and embedding pipeline.
 * Owned by split 01 (indexing pipeline).
 *
 * This split (00) provides:
 *   - languages.ts: SUPPORTED_LANGUAGES constant
 *   - parser.ts: web-tree-sitter stub (section-07)
 *
 * Split 01 will add: chunker.ts, embedder.ts, and pipeline orchestration.
 */
export * from './languages';
export * from './parser';
