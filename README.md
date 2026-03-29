# RepoMind

AI-powered codebase context engine. Index repositories via AST parsing, store embeddings in pgvector, and ask natural language questions about your code using RAG with hybrid search.

## Tech Stack

- **Next.js 16** (App Router, TypeScript strict)
- **Tailwind CSS v4** + shadcn/ui (base-ui)
- **Supabase** (Auth, PostgreSQL, pgvector)
- **web-tree-sitter** (AST parsing, 16 languages)
- **Ollama** (local embeddings + LLM, gte-qwen2-1.5b-instruct / qwen2.5-coder)
- **AI SDK v6** (streaming, provider registry, reranking)
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

Optional: `OLLAMA_BASE_URL`, `OPENAI_API_KEY`, Claude/OpenAI/Cohere API keys (configured in Settings UI)

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
| `POST` | `/api/chat` | Stream a RAG query (SSE) |
| `GET` | `/api/chat/history` | Paginated message history |
| `POST` | `/api/chat/feedback` | Thumbs up/down on answers |
| `GET/PUT` | `/api/settings/team` | Team LLM/search configuration |

## Architecture

```
Indexing:  GitHub API -> File Cache -> Tree-sitter -> AST Analyzer -> Semantic Chunker -> Embeddings
                                            |                                               |
                                      Graph Builder                                     Supabase
                                            |                                          (pgvector)
                                       graph_edges ─────────────────────────────────────────┘

Querying:  User Question -> Query Analyzer -> Hybrid Search (pgvector + FTS + RRF)
                                                  |
                                            Graph Traversal -> Context Assembly -> Prompt Builder
                                                                                       |
                                                                                  LLM Provider
                                                                              (Ollama/Claude/OpenAI)
                                                                                       |
                                                                                  SSE Stream -> Chat UI
```

**Indexing modules:** StorageProvider, GitHubClient, GitHubFileCache, File Filter, AST Analyzer, Semantic Chunker, Embedding Providers (Ollama/OpenAI), Graph Builder, Pipeline Orchestrator

**RAG modules:** Query Analyzer (heuristic classifier), Retriever (hybrid search + RRF fusion + batched graph traversal), Prompt Builder (per-language templates), Provider Registry (Ollama/Claude/OpenAI fallback chain), Evaluation Harness (faithfulness, relevance, source accuracy metrics)

**Database:** 9 tables with RLS, HNSW vector index, FTS via tsvector, hybrid search function with RRF, masking view for API keys (`repositories`, `repository_settings`, `cached_files`, `code_chunks`, `graph_edges`, `indexing_jobs`, `chat_messages`, `query_feedback`, `team_settings`)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run test:run` | Run tests (314 tests) |
| `npm run eval` | Run RAG evaluation harness |
| `npm run setup` | Download tree-sitter grammars |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Project Structure

```
src/
  app/
    (auth)/              # Login, OAuth callback
    (dashboard)/         # Authenticated pages (chat, repos, settings)
    api/repos/           # Repository + indexing API routes
    api/chat/            # RAG chat API (streaming, history, feedback)
    api/settings/team/   # Team settings API
  components/
    chat/                # Chat UI components (messages, input, source panel)
    ui/                  # shadcn/ui base components
  lib/
    storage/             # StorageProvider + Supabase implementation
    github/              # Auth, API client, file cache
    indexer/             # Code indexing pipeline
      ast-analyzer.ts    # Symbol/import/call/inheritance extraction
      chunker.ts         # Semantic code chunking
      file-filter.ts     # Smart file filtering
      graph-builder.ts   # Knowledge graph edges
      pipeline.ts        # Indexing orchestration
      embedding/         # Ollama + OpenAI embedding providers
      queries/           # Tree-sitter query patterns
    rag/                 # RAG query engine
      query-analyzer.ts  # Query classification heuristics
      retriever.ts       # Hybrid search + graph traversal
      prompt-builder.ts  # Per-language prompt templates
      providers.ts       # LLM provider registry + fallback
      types.ts           # RAG type definitions
      __eval__/          # Evaluation harness (metrics, runner)
    supabase/            # Client factories
  types/                 # TypeScript types
supabase/migrations/     # Database migrations
```

## Deployment

Deploy to [Vercel](https://vercel.com). Set env vars in Vercel dashboard. Apply migration to remote Supabase before using API endpoints.
