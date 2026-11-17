# Gem Management UI direction

## Authentication layout maintenance

- Keep ENERGY 1 / RHYTHM 2 / MOTION 1 and the existing system typography and indigo identity.
- Show the split authentication layout from 1100px; smaller windows use one centered form so setup fields remain readable rather than compressed.
- Let the desktop form fill its grid track, stack currency settings, and top-align fieldset contents so labels and inputs align without truncating the currency prompt.
- Use document scrolling and safe automatic margins instead of a fixed-height, clipped form so headings, validation errors, and account-switch links remain reachable on short screens.
- Reserve password-toggle space inside the input so entered text cannot overlap the Show/Hide button; retain existing accessible control names and keyboard behavior.

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
- Mobile: overview and full inventory reflow into stacked records instead of a shrunken desktop table. Full inventory keeps custody, evidence, weight, and role-permitted price fields.
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
- Mobile navigation uses labeled bottom tabs and a modal More sheet with focus management; desktop tables keep local overflow where needed.
- The walkthrough follows the actual seven business handoffs rather than a generic three-step presentation.
- AI is confined to a read-only question workspace and explicit report extraction. Setup status is visible, draft fields require confirmation, and stock/money controls remain deterministic.
- Original documents are private unless a reviewer explicitly selects them for buyer sharing.
- External payment, accounting, shipping, tax and marketplace services are identified as unconnected. No interface claims these integrations work.

## iPhone Home Screen pass

The mobile navigation is now a safe-area-aware toolbar and labeled, role-aware bottom tab bar. Overflow workspaces and appearance controls are in a native-dialog sheet. Phone records use labeled, stacked rows rather than horizontal desktop tables; the desktop tables and their fields remain available at wider widths. Overview uses a compact recent-stock preview with a detail link on each row, while Stock retains both detailed list and card views. Native scrolling remains uninterrupted; the brief sheet entry and press feedback respect Reduce Motion. The workspace can be added from Safari through Add to Home Screen; it uses its own icon and standalone manifest. This does not enable offline transactions outside the existing Show mode workflow.

Sign-in and first-run owner setup use the same gem artwork as Safari’s Home Screen icon. Sign-in keeps the authenticator code tucked away until requested, and opens and focuses it when the server requires it. Setup separates owner credentials from workspace preferences without adding public self-registration. Both screens keep labels visible and use native autofill and pickers.

## Menus and control bars

Dropdowns share one field style across setup, inventory filters, transaction editors, and buyer decisions. Pointer-driven browsers with [customizable select support](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select) also get a styled options list; touch and fallback browsers retain the platform picker. Native select semantics, form submission, and keyboard interactions are unchanged.

The top bar identifies the current workspace, the sidebar and phone dock share a tinted selection state, and the More sheet supports searching the destinations available to the signed-in role. Inventory controls use the same quiet surfaces for search, filters, view switching, and pagination; active filters and selections use the indigo accent.
