# RepoMind

AI-powered codebase context engine. Index repositories via AST parsing, store embeddings in pgvector, and chat with your code using RAG.

## Tech Stack

- **Next.js 16** (App Router, TypeScript strict)
- **Tailwind CSS v4** + shadcn/ui (base-ui)
- **Supabase** (Auth, PostgreSQL, pgvector)
- **web-tree-sitter** (AST parsing, 16 languages)
- **Ollama** (local embeddings, gte-qwen2-1.5b-instruct)
- **Vitest** + React Testing Library

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (or local via Docker)
- A [GitHub OAuth App](https://github.com/settings/developers) (for authentication)
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (for indexing repos)
- [Ollama](https://ollama.com) (optional, for local embeddings)

## Setup

```bash
npm install
cp .env.example .env.local
npm run setup                        # Download tree-sitter WASM grammars
npx supabase start                   # Start local Supabase (requires Docker)
npx supabase db push --local         # Apply migrations
ollama pull gte-qwen2-1.5b-instruct  # Optional: local embedding model
npm run dev
```

## Environment Variables

See `.env.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side, bypasses RLS)
- `GITHUB_PAT` (Personal Access Token with `repo` scope)

Optional: `OLLAMA_BASE_URL`, `OPENAI_API_KEY`

GitHub OAuth is configured in Supabase Dashboard (Authentication > Providers > GitHub).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/repos` | Add a repository |
| `GET` | `/api/repos` | List repositories with job status |
| `DELETE` | `/api/repos/:id` | Remove repo and all indexed data |
| `POST` | `/api/repos/:id/index` | Trigger indexing |
| `POST` | `/api/repos/:id/index/process` | Continue batch processing |
| `GET` | `/api/repos/:id/status` | Get indexing job status |
| `GET/PUT` | `/api/repos/:id/settings` | Get/update indexing settings |

## Architecture

```
GitHub API -> File Cache -> Tree-sitter -> AST Analyzer -> Semantic Chunker -> Embeddings
                                               |                                    |
                                         Graph Builder                          Supabase
                                               |                             (pgvector)
                                          graph_edges ──────────────────────────────┘
```

**Key modules:** StorageProvider, GitHubClient, GitHubFileCache, File Filter, AST Analyzer (Tree-sitter queries), Semantic Chunker (AST bin-packing + context prepending), Embedding Providers (Ollama/OpenAI), Graph Builder, Pipeline Orchestrator (self-chaining batches, concurrency guard, stale detection)

**Database:** 6 tables with RLS, HNSW vector index, transactional functions (`repositories`, `repository_settings`, `cached_files`, `code_chunks`, `graph_edges`, `indexing_jobs`)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test:run` | Run tests (204 tests) |
| `npm run setup` | Download tree-sitter grammars |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Project Structure

```
src/
  app/
    (auth)/              # Login, OAuth callback
    (dashboard)/         # Authenticated pages
    api/repos/           # API route handlers
  lib/
    storage/             # StorageProvider + Supabase implementation
    github/              # Auth, API client, file cache
    indexer/
      ast-analyzer.ts    # Symbol/import/call/inheritance extraction
      chunker.ts         # Semantic code chunking
      file-filter.ts     # Smart file filtering
      graph-builder.ts   # Knowledge graph edges
      pipeline.ts        # Indexing orchestration
      embedding/         # Ollama + OpenAI providers
      queries/           # Tree-sitter query patterns
    supabase/            # Client factories
  types/                 # TypeScript types
supabase/migrations/     # Database migrations
```

## Deployment

Deploy to [Vercel](https://vercel.com). Set env vars in Vercel dashboard. Apply migration to remote Supabase before using API endpoints.
