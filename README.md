# Gem Management

A local full-stack workspace for loose-gemstone stock, evidence, custody, trading and settlement. React and TypeScript provide the interface; Express and SQLite persist records and original documents. The design follows the existing Bitmo palette and Apple-inspired typography, hierarchy and feedback.

## Open the app

Requires Node 24.2 or newer with `node:sqlite` support.

```sh
npm install
npm run dev
```

Open the Vite URL, normally http://127.0.0.1:5173. The API runs on http://127.0.0.1:3001. If another Vite server is already open it may use the next port. First use asks you to create an owner account, choose the base currency and country, and optionally designate the workspace for training. There are no default credentials or preloaded commercial records.

Use **Settings → People & roles** to create individual team accounts. Sign out and sign in to demonstrate actual role restrictions. The owner can perform each departmental task. Use **Walkthrough** for the seven-step meeting explanation.

For a production build served locally from the API:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. This build supports service-worker shell caching for downloaded show-device authority. Development uses Vite and does not install the production service worker.

## Working workflows

- First-run workspace setup, password sign-in, persistent sessions, optional authenticator MFA, password changes and account disabling.
- Server-side role permissions and filtered responses. Sales cannot read costs, suppliers or owner shares or export data. Clerks cannot set prices or issue invoices. Accounts cannot modify stone identity or evidence.
- Persistent stone intake with permanent IDs, decimal weights, location, custody and explicit ownership authority.
- Original PDF/JPEG/PNG uploads, preserved SHA-256 hashes, versioned supplier/lab/custody claims, conflict explanation and reviewed disclosure wording.
- Reviewer-selected original documents in buyer-safe private selections. New reports or claims invalidate the current disclosure approval.
- Time-limited holds with automatic release on server reads and commands. Sharing a selection does not create a reservation.
- Quotes, owner approval for excess discounts, and conversion with fresh stock and ownership checks.
- Supplier records, agreed purchase orders and clerk receipt, incoming supplier consignment, inspected supplier returns and verified supplier payments.
- Per-line outgoing memos, due dates, partial sale conversion, inspected returns and stock release.
- Atomic direct sales, PDF invoices retaining the disclosure version, foreign-currency invoices and decimal exchange-rate snapshots.
- Partial payment allocations (API supports several invoices in one currency), credit requests, Accounts-issued credits, verified refunds, broker/shared-owner settlement, expenses and cash-movement reconciliation.
- Lab/cutter issue and return, weight/loss validation, processing charges, yield and linked parcel splitting with exact cost conservation.
- Customers, physical stocktake discrepancies, CSV dry import with duplicate preview and explicit source-total reconciliation, CSV/JSON exports, immutable application audit events and complete SQLite backups including documents.
- Exclusive show-device assignments, downloaded authority, signed offline event queues, idempotent replay, conflict retention on the device and explicit reconciliation before release.
- A read-only, role-filtered AI assistant and human-confirmed report extraction when a server API key is configured.
- Responsive light/dark appearance, keyboard dialogs and a guided business walkthrough.

See [FEATURES.md](./FEATURES.md) for boundaries and competitor comparison, and [QA.md](./QA.md) for verification.

## Demonstrate one complete journey

1. Receive a clearly labelled training stone with weight, cost, price, location and confirmed ownership.
2. Attach a training document or add an explicitly labelled sample claim. Review it and approve training-only disclosure wording.
3. Release the draft to stock. Create a customer.
4. Create a quote or hold, or issue a memo containing several reviewed stones.
5. Convert one memo line to an invoice and inspect the return of another line.
6. Record a verified payment against the invoice. Receive a sale return, issue its credit and record the refund if needed.
7. Review audit events and reconciliation, export records and download a backup.

Use a training workspace for fabricated examples. Original laboratory findings and provenance should only be entered from real supporting evidence in a business workspace.

## AI configuration

Create an ignored `.env` file using `.env.example` as a guide, or set runtime environment variables. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. The key stays on the server; never use a `VITE_` variable for secrets. The app does not include or fabricate a key.

The assistant sends a bounded snapshot of authorized records to OpenAI when a user submits a question. Report extraction sends the selected original report when the user selects **Extract AI draft**. Neither flow posts financial entries or approves disclosure. Critical extracted fields require human confirmation, then normal reviewer approval. Provider output and financial accuracy have not been validated against a customer report corpus.

## Storage and backups

Runtime data is stored in ignored `data/gem.sqlite`, with SQLite WAL files during operation. Override `DATA_DIR` for a separate workspace. Keep the whole directory private; it contains business records, original documents, password hashes and show-device authority. A downloaded backup is sensitive.

Download a complete backup from Settings. To restore, stop the API cleanly and run:

```sh
node server/restore.mjs /absolute/path/to/backup.sqlite --confirm-replace
```

The restore checks integrity and required tables, preserves an existing database as a separate pre-restore copy, and revokes prior sessions. It refuses to run while WAL/SHM files remain. Keep a backup outside this computer and test restoration before live use.

## Deployment boundaries

This checkout currently runs locally. It has not been published or connected to a hosted database. Configure HTTPS, a persistent private data volume, `NODE_ENV=production` and the exact `APP_ORIGIN` before hosting. Add infrastructure-level backups, monitoring and operational recovery. Current local SQLite storage is a single-business workspace, not a multi-tenant SaaS service.

No card is charged and no money is transferred by recording a payment. Accounting connectors, payment gateways, tax filing, shipping services and external marketplaces need provider selection, credentials and integration work. Country entry is metadata, not validated local tax support. Generated invoice PDFs explicitly identify the need for launch-market tax review.

## Verification

```sh
npm run build
npm run lint
npm run test:api
npm run test:e2e
```

API tests use a temporary isolated database and check role restrictions, concurrent stock control, memo partial outcomes, exact decimal money, processing conservation, uploads, private buyer fields, credits/refunds, quotes, foreign exchange, signed show replay and imports. Browser tests use separate API/Vite ports and an isolated database.

### Use on an iPhone

Open the workspace's reachable HTTPS URL in Safari. From **Share**, choose **Add to Home Screen**, then enable **Open as Web App** if shown. Open **Gem Stock** from the Home Screen. A link to `localhost` on your Mac won't reach the workspace from your phone. Home Screen installation does not make the workspace generally available offline; only the existing assigned Show mode supports offline work.
