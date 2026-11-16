# AGENTS.md — Project Memory & Architecture Guide

## 1. Project Overview & Tech Stack

- **Purpose:** A local, single-business workspace for loose gemstone inventory, evidence review, custody, sales, purchasing, processing, settlement, and show-device workflows.
- **Frontend:** React 19 with TypeScript, Vite 7, and app-specific CSS. There is no component framework or client-side router dependency.
- **Backend / API:** Node.js 22 (the package engine declaration) with Express 5. The same API is exposed through `api/index.mjs` for Vercel.
- **Database / Storage:** Node's built-in `node:sqlite`, stored under `data/` locally or `/tmp/gem-data` on Vercel by default. Original uploaded files are stored as SQLite BLOBs. `DATA_DIR` overrides the storage directory.
- **Deployment:** Vercel config builds the Vite frontend into `dist`; the documented supported operating mode is local. The docs explicitly state that persistent hosted storage, backups, monitoring, HTTPS configuration, and operational recovery still need deployment work.

## 2. Architecture & File Structure

```text
api/index.mjs             Vercel adapter to the Express API
server/index.mjs           HTTP routes, auth, validation and application orchestration
server/domain.mjs          Business rules and core domain operations
server/purchasing.mjs      Purchasing and supplier domain operations
server/db.mjs              SQLite schema, persistence, transaction and audit helpers
server/ai.mjs              Optional OpenAI report extraction
server/restore.mjs         Validated SQLite backup restore command
server/domain.test.mjs     Node API/domain tests
server/seed.sqlite         Vercel seed database input
src/main.tsx               React application entry point
src/api.ts                 Frontend API client
src/data.ts                Frontend data and view-model logic
src/Purchasing.tsx         Purchasing interface
src/styles.css             Global UI styling and design tokens
tests/                     Playwright browser and role-audit tests
scripts/                   Operational scripts
DESIGN.md                  UI direction and interaction decisions
FEATURES.md                Feature boundaries and remaining scope
QA.md                      Verification plan and findings
```

The domain layer owns permissions, inventory availability, evidence approval, money arithmetic and transaction decisions. The HTTP layer uses these rules and persists business records in SQLite. Stone and transaction records are JSON in the `records` table; users, sessions, settings, file bytes, replay data and immutable audit events have dedicated tables. Financial arithmetic uses `decimal.js`.

## 3. Environment Variables & Integrations

| Variable | Description | Source / Service |
| :--- | :--- | :--- |
| `API_PORT` | Local Express API port; defaults through the server configuration. | Local runtime |
| `DATA_DIR` | SQLite data directory override. Treat the directory as sensitive business data. | Local filesystem / host volume |
| `GEM_API_PROXY` | Vite development proxy target for `/api`. | Local frontend dev server |
| `OPENAI_API_KEY` | Optional server-side key for read-only assistance and report extraction. Never expose it through a `VITE_*` variable. | OpenAI API |
| `OPENAI_MODEL` | Optional model override; documented default is `gpt-4.1-mini`. | OpenAI API |
| `NODE_ENV` | Set to `production` when serving behind HTTPS; affects secure session cookies. | Node runtime |
| `APP_ORIGIN` | Exact production origin allowed by the API's origin check. | Deployment configuration |
| `VERCEL` | Platform-provided flag; selects temporary `/tmp/gem-data` storage and secure cookies. | Vercel runtime |

Use `.env.example` as the authoritative local template. The application currently uses local SQLite, not Neon. External payment, accounting, tax, shipping, marketplace, and hosted database services are not connected.

## 4. Development & Build Commands

- `npm install` — install locked dependencies.
- `npm run dev` — start the watched API and Vite dev server.
- `npm run build` — run TypeScript project build and produce the Vite production bundle.
- `npm run typecheck` — run TypeScript checking without emitting output.
- `npm run lint` — run ESLint.
- `npm run test` or `npm run test:api` — run Node's API/domain test suite.
- `npm run test:e2e` — run Playwright browser tests; its config starts isolated API and Vite servers with a temporary database.
- `npm start` — serve the built app from the API.

The README says Node 24.2+ is required for `node:sqlite`; `package.json` currently declares Node 22.x. Resolve this documentation/runtime mismatch before changing the supported Node version.

## 5. Engineering & Design Conventions

- Keep domain decisions in `server/domain.mjs` and `server/purchasing.mjs`; route handlers should orchestrate requests, permissions, persistence, and responses.
- Use `Decimal` for weights, money, currency conversions, and cost allocation. Avoid binary floating-point arithmetic for business values.
- Enforce role permissions and sensitive-field filtering on the server. UI hiding is not authorization.
- Keep transaction mutations atomic, validate record versions for stale writes, and add audit events for business actions. Audit events are immutable at the database level.
- Preserve uploaded originals and their evidence history. Buyer disclosures require explicit reviewer approval and selected-document allowlists.
- Keep AI optional, server-side, read-only for business records, and subject to human confirmation. Do not use AI output to approve evidence or post financial entries.
- Follow `DESIGN.md`: restrained Bitmo indigo palette, system typography, clear operational hierarchy, semantic text labels for status, accessible keyboard dialogs, mobile-aware tables/navigation, and reduced-motion support. Avoid decorative gem illustrations and unsupported claims.
- Keep secrets in server environment variables. Never put secrets in frontend `VITE_*` variables or commit `.env` files.

## 6. Current Status & Active Roadmap

- **Documented implementation:** The README and feature inventory describe persistent local workflows for inventory, evidence, custody, purchasing, quotes, memos, invoices, payments, processing, imports/exports, role permissions, audit, show-device offline replay, and optional AI assistance.
- **Recent repository history:** Unavailable. This active folder has no `.git` directory, so branch and commit history could not be inspected.
- **Active work:** Not determinable from the available checkout. No placeholder status is inferred from file timestamps.
- **Known constraints:** The current folder is not a Git checkout; SQLite storage is single-workspace and not durable on Vercel's `/tmp`; deployment needs persistent private storage and operational controls; README runtime guidance (Node 24.2+) conflicts with package engine `22.x`; `vercel.json` includes `server/seed.sqlite`, while local data is under ignored `data/`.
- **Further scope documented in `FEATURES.md`:** Native spreadsheet import, public storefront/marketplace, live payment and accounting integrations, tax/shipping integrations, multi-tenant hosting, infrastructure backups/monitoring, and independent security review are not implemented.
