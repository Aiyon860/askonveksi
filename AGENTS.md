<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Skill Routing

- Before implementing any new feature, create a mature, decision-complete plan and sharpen it with the `grill-me` skill. Do not begin implementation until the scope, behavior, edge cases, and verification criteria are clear.
- For UI, visual design, UX, layout, responsive behavior, accessibility, or interface polish, use the `impeccable` skill.
- For Prisma Client queries and Prisma database access, use the `prisma-client-api` skill. Favor efficient query shapes and performance while keeping the result straightforward and readable for developers.
- For security-sensitive work—including untrusted input, authentication, authorization, sessions, personal data, storage, and external integrations—use the `security-and-hardening` skill.
- For UI component selection, installation, composition, styling, and shadcn best practices, use the `shadcn` skill.
- For page-load, navigation, rendering, Core Web Vitals, or bundle performance work, use the `performance` skill.
- For any Supabase work—including Database, Auth, Realtime, Storage, Edge Functions, RLS, and other Supabase services—use the `supabase` skill.
- When a task spans multiple areas, use every relevant skill. For example, Supabase Auth requires both `supabase` and `security-and-hardening`, while shadcn-based interface work requires both `impeccable` and `shadcn`.
