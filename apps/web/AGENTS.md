# web

The web app: one Cloudflare Worker that serves SSR and `/api/*`, with its data in D1.

- To run one test, run `vp test run <file>` in this workspace.
- Write D1 schemas in `*.table.ts` and run `vp run db:generate` in this workspace to create the migration. Generate the better-auth tables with `vp run auth:generate`.
