# RepoMind

AI-powered codebase context engine. Index repositories via AST parsing, store embeddings in pgvector, and chat with your code using RAG.

## Tech Stack

- **Next.js 16** (App Router, TypeScript strict)
- **Tailwind CSS v4** + shadcn/ui (base-ui)
- **Supabase** (Auth, PostgreSQL, pgvector)
- **web-tree-sitter** (AST parsing, 16 languages)
- **Vitest** + React Testing Library

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [GitHub OAuth App](https://github.com/settings/developers) (for authentication)

## Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in your Supabase credentials
cp .env.example .env.local

# Download tree-sitter grammar WASM files
npm run setup

# Apply database migrations (requires Supabase project)
npx supabase db push

# Start development server
npm run dev
```

## Environment Variables

See `.env.example` for the full list. Required:

- `NEXT_PUBLIC_SUPABASE_URL` - your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - your Supabase anon/public key

GitHub OAuth credentials are configured directly in the Supabase Dashboard (Authentication > Providers > GitHub), not in env vars.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run tests (watch mode) |
| `npm run test:run` | Run tests (single run) |
| `npm run test:coverage` | Run tests with coverage |
| `npm run setup` | Download tree-sitter grammar files |

## Project Structure

```
src/
  app/
    (auth)/          # Login, OAuth callback
    (dashboard)/     # Authenticated pages (Chat, Repositories, etc.)
  components/
    ui/              # shadcn/ui components
    app-sidebar.tsx  # Navigation sidebar
    theme-*.tsx      # Theme provider and toggle
  lib/
    supabase/        # Browser and server client factories
    indexer/          # AST parser, language definitions
    rag/             # RAG query engine (split 02)
    graph/           # Knowledge graph (split 04)
    auth/            # Auth helpers
  types/             # Shared TypeScript types
```

## Deployment

Deploy to [Vercel](https://vercel.com). Connect the repo and set the environment variables in the Vercel dashboard.
