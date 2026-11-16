# Verification and delivery gate

Verified against the current local implementation on 26 October 2026. Tests use isolated temporary databases. The real workspace is empty and requires its owner to finish setup. This is not a production security certification or proof of competitor superiority.

## Automated checks

- `npm run build`: TypeScript project build and Vite production bundle.
- `npm run typecheck`: strict source type checking.
- `npm run lint`: source, API, service worker and test linting.
- `npm test`: 19 API integration tests.
- `npm run test:e2e`: three browser journeys with separate API and Vite processes.

The browser journeys cover setup (including show/hide password, country/currency dropdowns and currency-decimal defaults), persistent intake, evidence claims and approval, original PDF upload, explicit buyer document sharing, holds and release, outgoing memo issue and return, lab/cutter issue and return, quote conversion, payments, customer and supplier records, purchase receipt and supplier payments, CSV preview and source-total confirmation, stocktake discrepancy output, backup download, MFA setup QR, team account creation, sign-out/sign-in and role navigation. Every exposed section is visited. Native dialog Escape is exercised. Inventory is checked with axe in light and dark appearances; the guided walkthrough is checked at a 390 px mobile viewport with no document overflow. No browser page errors were recorded.

The API suite verifies concurrent holds, stale version rejection, protected fields and exports, private buyer field allowlists, partial memo sale/return, precise partial payment balances, overpayment rejection, processing weight and cost conservation, exact parcel cost allocation, credits and refund limits, original upload bytes, CSRF, discount approvals, FX snapshots, signed show replay and replay idempotency, blocked-event owner review, import duplicates, supplier liabilities and isolated backup restoration including original documents and revoked sessions.

## Antislop gate

### Hard gate

- R-02 PASS: source scan found no em/en dashes in generated product code or text.
- R-03 PASS: the 390 px browser journey has no document-level horizontal overflow; record tables and step navigation scroll inside bounded containers.
- R-17 PASS: overview figures derive from saved records; financial aggregates use server decimal arithmetic. No fabricated performance or customer statistics.
- R-18 PASS: no testimonials, invented staff avatars or customer endorsements.
- R-23 PASS: no generated brand logos, gemstone photos or outside identity assets. QR images encode actual permanent record IDs. Test examples are explicitly labelled training data.
- R-24 PASS: navigation entries render implemented sections. File, buyer, invoice and export links point to actual API routes.
- R-25 PASS: representative light/dark axe scans report zero violations. Core text token contrast calculations range from 4.91:1 to 15.52:1; light accent on white is 12.58:1 and dark accent on its surface is 8.25:1.
- R-26 PASS: controls are wired to navigation, dialog forms, API actions, downloads or explicit setup. Unconfigured AI shows a setup explanation rather than a pretend response.
- R-27 PASS: first-run setup, connection loading/error, empty collections, filtered-empty inventory, save errors and pending AI states are explicit.
- R-28 PASS: no generic FAQ section.
- R-32 PASS: native controls, visible focus rings, a skip link, modal dialog focus return, Escape dismissal and mobile-drawer focus management.
- R-33 PASS: behavior and styling live in tracked source files; no runtime DOM patching or injected CSS customization.
- R-34 PASS: the browser journey switches to dark appearance, passes axe and checks mobile reflow.
- R-35 PASS: production build, API journeys and recorded browser click-throughs pass. External integrations, physical scanner hardware, real-device loss and customer-report accuracy are identified below as unverified.
- R-36 PASS: no claims of security certification, guaranteed origin, gemstone authentication or proven competitive uniqueness.
- R-37 PASS: retained DESIGN.md direction is explicit: Apple-inspired web workspace, ENERGY 1 / RHYTHM 2 / MOTION 1.
- R-38 PASS: the real database starts empty. Automated test records are named Training and are confined to temporary test workspaces.

### Purpose gate

- R-01 PASS: no gradients, radial glows or decorative backgrounds. Indigo is the retained primary action/selection color.
- R-04 PASS: restrained line symbols identify inventory, custody, money and navigation; no sparkle/robot decoration.
- R-06 PASS: platform system typography supports dense operational records. Monospace is limited to raw record inspection and setup keys.
- R-07 PASS: no background grids or dot textures.
- R-08 PASS: actions use explicit text labels instead of repeated decorative arrows.
- R-09 PASS: badges represent actual stock, evidence and workflow status.
- R-10 PASS: translucency is limited to the toolbar and dialog backdrop. Content remains opaque.
- R-12 PASS: shadows distinguish modal surfaces and transient save feedback; record collections remain flat.
- R-13 PASS: no glow effects.
- R-14 PASS: overview counts, records, walkthrough steps and forms use structures suited to their content rather than identical feature cards.
- R-19 PASS: only immediate press/hover feedback; no entrance choreography, loops or artificial delays. Reduced-motion preferences are respected.
- R-22 PASS: no generic illustrations.

### Liveliness and craftsmanship

- Dials PASS: ENERGY 1 / RHYTHM 2 / MOTION 1 are recorded in DESIGN.md and reflected in the interface.
- Hierarchy PASS: each section leads with its task and primary action. Overview leads with sellable stock; evidence leads with its review queue.
- Spacing PASS: broad page/section separation contrasts with compact transaction rows and paired form fields.
- Identity PASS: permanent stone IDs, custody, disclosure versions, memo due dates and weight reconciliation make the interface specific to gemstone trade.
- C-1 / R-31 PASS: typography, palette, surfaces, mobile structure and motion decisions have written reasons in DESIGN.md.
- C-2 PASS: transactions await server results and show validation failures. No fake holds, approvals, payments or AI replies.
- C-3 / R-05 PASS: the page structure follows actual business handoffs and records, without a marketing template.
- C-4 PASS: responsive drawer, bounded table scrolling, native dialogs, reduced-motion and light/dark tokens are implemented and representative states are tested.
- C-5 PASS: claims distinguish current capabilities, vendor descriptions, proposed differentiation and unconnected services.
- R-11 PASS: controls, grouped records, status markers and dialogs have distinct radius roles.
- R-15 / R-16 PASS: labels name the operation: Receive stock, Preserve claim, Issue memo, Record payment and Confirm totals & import.
- R-20 / R-30 PASS: the design uses Apple principles without macOS imitation; the workflow remains specific to loose-gem trade.
- R-21 PASS: light is the default; the user can switch to a tested dark appearance.
- R-29 PASS: the retained neutral palette and indigo action accent use explicit semantic success/warning/error colors.

## Practical limits

- No OpenAI credential was available. The assistant and report-extraction requests are implemented but were not exercised against a live provider. No extraction accuracy claim is made.
- The show authority/signature/replay/conflict rules are API-tested. Full offline browser reload, physical device loss, browser-storage loss and real show-floor behavior still need a pilot. Cached show authority is sensitive device data.
- The local app is single-business, stores its SQLite database and original documents on disk, and is not deployed. HTTPS hosting, encrypted infrastructure, managed backups, monitoring and independent security assessment remain deployment work.
- Payment actions record verified receipts/refunds; they do not initiate bank transfers or card charges. Provider-specific accounting, payment, tax, shipping and marketplace connections are not implemented.
- Base-currency cash reconciliation preserves FX snapshots, but is not a general ledger, bank feed or realized-FX gain/loss report.
- Supplier credits/refunds, full multi-currency procurement, advanced layouts, price tiers, spreadsheet formats beyond CSV, public storefronts and marketplace distribution remain outside the implemented core. See FEATURES.md.
- PDF invoice output currently uses standard Latin text rendering. Launch-country tax and document requirements need review before commercial use.
