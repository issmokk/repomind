@AGENTS.md

# RepoMind

AI-powered codebase context engine. Next.js 16, Supabase, web-tree-sitter.

## Stack

- **Next.js 16** (App Router, TypeScript strict, `src/` directory)
- **Tailwind CSS v4** (CSS-first config, `@theme` directives, no `tailwind.config.ts`)
- **shadcn/ui v4** (uses `@base-ui/react`, NOT `@radix-ui`)
- **Supabase** (Auth with GitHub OAuth, pgvector)
- **Vitest** + React Testing Library

## shadcn/ui v4 + Base UI Gotchas

This project uses shadcn/ui v4 which is built on `@base-ui/react`, not Radix UI. This changes several common patterns:

- **No `asChild` prop.** Base UI components use `render` prop instead. Example: `<SidebarMenuButton render={<Link href="/chat" />}>` instead of `<SidebarMenuButton asChild><Link href="/chat">`.
- **Button + Link composition.** Do NOT use `<Button render={<Link />}>` as it triggers a Base UI warning about non-native button elements. Instead, use `buttonVariants()` directly on the Link: `<Link className={buttonVariants()}>`.
- **DropdownMenuTrigger** renders its own `<button>`. Don't wrap a `<Button>` inside it. Apply styling classes directly to the trigger.
- **`buttonVariants()` is client-only.** Since `button.tsx` has `'use client'`, `buttonVariants()` cannot be called from server components. In server components, use plain Tailwind classes instead.

## Supabase Auth

- Auth gating lives in `src/proxy.ts` (NOT `middleware.ts`, which is deprecated in Next.js 16)
- Proxy uses `getUser()`, never `getSession()` (server validation vs local JWT decode)
- `@supabase/ssr` with `createBrowserClient` / `createServerClient` pattern
- `cookies()` from `next/headers` is async in Next.js 15+
- PKCE flow is automatic, no manual CSRF/state validation needed

## Next.js 16 Specifics

- `outputFileTracingIncludes` is a top-level config property (not under `experimental`)
- `outputFileTracing: true` is not a valid config key (removed)
- **Turbopack is the default** in Next.js 16. Adding `turbopack: {}` to next.config.ts lets Turbopack run for dev while keeping the webpack config for production builds. No `--webpack` flag needed.
- **`middleware.ts` is deprecated**, renamed to `proxy.ts`. Export `proxy()` function instead of `middleware()`
- Supabase migration files require timestamp prefix (`20240101000000_name.sql`), not sequential numbering

## Testing

- Vitest with `@vitejs/plugin-react` and native `resolve.tsconfigPaths`
- jsdom environment for component tests, `// @vitest-environment node` for server code
- `@testing-library/jest-dom/vitest` for DOM matchers
- Tests colocated next to source files (`*.test.ts` / `*.test.tsx`)
- web-tree-sitter must be fully mocked in tests (WASM not available in jsdom). Use a class mock for `Parser` since `vi.fn()` is not constructable.

## Implementation Quality Rules

When using `/deep-implement` or implementing code in sections:

1. **After each section commit**: Run `npm run lint` and fix all errors/warnings before moving to the next section. Do not let lint debt accumulate.
2. **After each section commit**: Run `npm run test:run` to verify all tests pass.
3. **After all sections in a split are done**: Review and update `README.md` and `docs/architecture.md` to reflect new modules, data flows, ER diagrams, and commands. Commit doc updates separately.
4. **Before marking a split complete**: Run `npm run build` to verify production build passes (strict mode catches errors vitest misses).
5. **Never skip code review**: Every section gets a code-reviewer subagent. Every review gets triaged and important findings get fixed.

Quality and accuracy over speed. Do not rush. Patches and debt accumulate fast when verification steps are skipped.

## Git / PR

- `GITHUB_TOKEN` env var is a fine-grained PAT without PR permissions. Before running `gh pr create`, unset it: `unset GITHUB_TOKEN && gh pr create --draft ...`
- The keyring token (from `gh auth login`) has full `repo` scope and works for PR creation.
- Always create draft PRs (`gh pr create --draft`).

## Commands

```
npm run dev          # Start dev server
npm run typecheck    # TypeScript strict check (tsc --noEmit)
npm run test:run     # Typecheck + tests (single run)
npm run eval         # Run RAG evaluation harness (separate from tests)
npm run setup        # Download tree-sitter grammar WASM files
npm run lint         # ESLint
npm run format       # Prettier
```

## Grammar WASM Files

Downloaded via `npm run setup` from two npm packages:
- `tree-sitter-wasm-prebuilt` (12 languages)
- `@sourcegraph/tree-sitter-wasms` (fills gaps: TypeScript, Swift, Kotlin, Scala)

WASM files live in `wasm/` and are gitignored. Run `npm run setup` after clone.
