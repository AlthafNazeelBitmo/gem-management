# Workflow and competitor comparison

This is an implementation inventory, not a claim of feature parity or vendor reliability. Competitor descriptions were reviewed in the supplied market-gap proposal and public vendor pages; no competitor trial account was used. The proposal lists eight systems without ranking them. The initial three benchmarks were GemCloud, Nveloop GMS and Carat Logic; Gem Logic and GemPro were added as trial options.

| Area | Current implementation | What to compare in competitor trials |
|---|---|---|
| Stock register | Permanent stone IDs, parcels/counts, decimal carats, custody and location, status search, uploads, labels | Rich gem attributes, custom fields and import ergonomics |
| Evidence | Original files, distinct versioned claims, explicit conflicts, approved wording, per-invoice snapshots and reviewer-selected buyer documents | Certificate archives are not proof of equivalent review/version controls |
| Availability | Atomic state mutations, version checks, timed holds, ownership/custody checks, show exclusivity | Test competing reservations and final sales |
| Purchasing | Suppliers, purchase orders, receipt of agreed stock, incoming consignment, supplier returns and paid obligations | Multi-currency purchasing, supplier credits and wider procurement processes |
| Customers | Contact records with linked selections, memos and invoices | CRM follow-ups, segmentation and richer contact history |
| Quotes | Offers at selected prices, expiry, above-limit owner approval and stock-checked conversion | Price tiers, multi-line price editing and offer PDF layouts |
| Outgoing memos | Due dates, line-specific conversion and inspected returns | Partial parcels, commission and settlement edge cases |
| Processing | Named issue/return, weights, loss, charges, yield and weight-based split allocation | Full manufacturing stages, configurable allocation rules and contractor reporting |
| Sales and money | Invoices, PDFs, partial allocations, FX snapshots, credits, refunds, verified receipts, expenses and settlements | Legal invoice formats, realized FX reporting, payment-provider integrations and full accounting |
| Buyer experience | Expiring private selection links, reviewed descriptions and explicit document allowlist; interest/hold-request/decline | Storefronts, ecommerce checkout, marketplace reach and link revocation controls |
| Counts/import/export | Physical location count, discrepancy report, CSV dry import with duplicate references and source-total confirmation, CSV/JSON exports | Native XLSX support, field mapping, pricing tiers and large-stock performance |
| Access and history | Individual accounts, optional TOTP, server permissions, filtered responses, append-only application audit trail | Independent security review, tenant isolation, detailed administrative policy and account recovery |
| Show operations | Single-device authority, signed local queue, replay protection, exclusive assigned stock and explicit release | Real-device outages, lost browser storage, lost devices, clock drift and multi-channel conflicts |
| AI | Optional read-only assistant and report extraction, requiring a server key and human field confirmation | Measured report accuracy, correction time and authorized-context isolation |
| Adoption | Guided walkthrough, explicit training workspace, light/dark appearance and clear handoffs | First-day onboarding time and repeated real-dealer use |

## Remaining scope

- Native spreadsheet workbooks beyond CSV, custom import mapping, advanced matched layouts and configurable price tiers.
- A public catalog/storefront, multi-dealer marketplace, checkout and distribution feeds.
- Live card payments, accounting sync, tax calculation/filing, shipping and export-document providers.
- Automated commission/share calculations and realized FX gain/loss accounting; current settlements record verified amounts.
- Multi-tenant hosting, encrypted database storage infrastructure, managed backups, deployment, monitoring and independent security review.
- Production validation across real parcels, browser/device loss, offline failures, AI document varieties and actual launch-country documents.

These items are not presented as implemented. Jewelry CAD, metal accounting, payroll and a full general ledger remain outside the initial scope of the supplied proposal.

## Proposed differentiation

Evidence review, consistent custody/availability and safe show continuity are implementation priorities. Their existence in this code does not establish uniqueness, customer demand or superiority over competitors. Those require comparative trials and pilot evidence.
