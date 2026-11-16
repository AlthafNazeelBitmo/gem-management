# Gem Management UI direction

The user's current direction is a professional, minimal interface using the installed Apple design and design skills, with antislop applied during implementation. The supplied Bitmo palette remains the source for brand colors. Company logos remain omitted.

Reading this as a professional stock workspace with Apple's clarity and restraint. ENERGY 1 / RHYTHM 2 / MOTION 1.

## Decisions

- Layout: inventory counts and unresolved handoffs lead because owners need to assess stock and next actions; the stock book and recent changes sit directly below.
- Typography: platform system typography replaces brand display typography for controls and records, following the user's Apple design direction; larger sizes and weight establish hierarchy without uppercase ornaments.
- Color: indigo #270286 identifies selected navigation and primary actions; violet #4A22B0 is a hover accent; bone #F5F4F0 separates navigation; ink #1C1B22 anchors readable text on white. Gold is omitted because this workspace has no priority action requiring it.
- Surfaces: content stays on the page, with separators for records; one pale panel groups unresolved work. Repeated boxes, colored icon tiles, and the oversized indigo sidebar are removed.
- Spacing: a larger break separates page navigation, inventory summary, and records; tighter row spacing groups a stone's identity, status, and evidence.
- Status: small labeled semantic markers identify stock states; no generic promotional badges. Status is always expressed in text as well as color.
- Icons: consistent single-weight line symbols aid navigation; synthetic gemstone illustrations are removed because the demo has no real intake photographs.
- Navigation: one-level sidebar stays familiar and quiet; the current location receives a subtle indigo selection. The mobile drawer has a scrim and Escape dismissal, and closed navigation is hidden from keyboard traversal.
- Controls: the reporting period is shown only on the overview where it changes the activity feed. A segmented stock selector and text links expose common operations without extra chrome.
- Mobile: overview stock rows reflow into two-line records instead of a shrunken desktop table. Full inventory tables remain horizontally scrollable so custody and evidence fields stay available.
- Motion: immediate press feedback and short hover transitions confirm input. There are no entrance animations or decorative movement; reduced motion disables transitions.
- Material: only the sticky toolbar has subtle translucency, to keep the scrolled content distinct. Reduced transparency and increased contrast use an opaque surface.
- Identity: permanent IDs, explicit custody, evidence status, and memo deadlines make the workspace specific to gem operations.
- Copy: operational labels replace slogans; the decorative stock journey and duplicate workspace labels are removed. Demo labeling remains explicit.

## Applied references

- Installed `antislop`, `antislop-ui`, `antislop-copywriting`, `antislop-human`, and `antislop-layoutmobile` filters.
- Installed Apple web design skill: typography, immediate feedback, restrained materials, reduced motion, and simplicity.
- Installed Apple HIG skill: accessibility, layout, typography, color, sidebars, lists and tables, buttons, modality, and web translation.
- Installed `design` routing and `design-system` token architecture: primitive palette, semantic surface/text/status aliases, and component control tokens.

The design applies Apple principles to a React web app, with web-native navigation and dialogs. It does not imitate macOS window chrome or display an Apple logo.

## Current scope and interaction decisions

The workspace is now backed by a local persistent API and SQLite database. It starts empty. Training mode is explicitly selected during setup; only automated test workspaces contain seeded examples. Counts and activity come from stored records.

The original direction remains ENERGY 1 / RHYTHM 2 / MOTION 1. System typography makes dense records readable; the retained indigo identifies the primary action. Statuses use text and semantic colors. No decorative illustrations, generated gemstone photos, invented customer claims or charts are used.

- Flat page sections keep inventory and outstanding work readable; bordered surfaces group one transaction or collection.
- The first-run form creates real owner credentials instead of a role-preview selector.
- Native dialogs keep a transaction focused, preserve form errors, and return keyboard focus after closing.
- Light/dark tokens preserve the same hierarchy; appearance changes are immediate to avoid intermediate low-contrast text.
- Mobile navigation becomes a labelled drawer with focus management; wide records scroll within their own container.
- The walkthrough follows the actual seven business handoffs rather than a generic three-step presentation.
- AI is confined to a read-only question workspace and explicit report extraction. Setup status is visible, draft fields require confirmation, and stock/money controls remain deterministic.
- Original documents are private unless a reviewer explicitly selects them for buyer sharing.
- External payment, accounting, shipping, tax and marketplace services are identified as unconnected. No interface claims these integrations work.
