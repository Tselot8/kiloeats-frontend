# KiloEats frontend

React 18, React Router 7, and Vite 6 frontend for KiloEats, a university food
delivery project. The existing interface primarily manages restaurant menus,
incoming orders, and restaurant profiles. Student cart and checkout flows are
not implemented.

## Prerequisites

- Node.js 22.x and npm 10.x (verified with Node 22.14.0 and npm 10.9.2).
- A modern browser. Network access is needed to install dependencies and load
  the configured remote API and external food images.

## Setup

Run from the repository root:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Vite selects
another port if that port is occupied. On Windows, use `npm.cmd` in place of
`npm` if PowerShell blocks the npm script.

Use `npm ci` to reproduce `package-lock.json`; no environment variables or
separate backend startup are required to start the frontend itself.

## Merchant API configuration

Menu, orders, and profile share `VITE_API_BASE_URL`, resolved in
`src/utils/config.js`. If unset or blank, it defaults to the existing public
service, `https://kilo-eats-backend.onrender.com`.

To override it, copy `.env.example` to `.env.local` and set the public API URL:

```dotenv
VITE_API_BASE_URL=https://api.example.invalid
```

This is a placeholder; substitute your actual service address. Absolute HTTP(S)
URLs may include a path prefix; trailing slashes are removed. Credentials, query
strings, and fragments are rejected with a visible configuration error instead
of crashing the app or silently falling back. Restart Vite after changing the
setting; rebuild production assets to change a production API URL. Preview uses
the value baked into the build, not a runtime server setting.

**All `VITE_*` values are public browser code. Never put secrets, passwords, API
keys, or private tokens in them.** Local `.env` files are ignored by Git; only
the placeholder example is tracked. The API must permit the frontend origin
through CORS, including existing PATCH/DELETE requests. Vite provides no API
proxy or backend. Changing this setting does not enable authentication.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload. |
| `npm run build` | Build production assets into `dist/`. |
| `npm run lint` | Check JavaScript and JSX with ESLint. |
| `npm test` | Run all isolated regression tests; no live requests or credentials. |
| `npm run test:menu` | Run isolated menu API and validation regression tests with Node's built-in test runner. No live requests are made. |
| `npm run test:orders` | Run isolated order parsing, transition, mutation, and read-back regression tests. No live requests are made. |
| `npm run test:profile` | Run isolated profile parsing, validation, save, and read-back regression tests. No live requests are made. |
| `npm run test:auth` | Run isolated auth validation, payload, availability, and adapter-failure tests. No live requests are made. |
| `npm run test:reliability` | Check API URL validation and distinguish HTTP, malformed, network/body-download, timeout, and empty-data outcomes. |
| `npm run preview` | Serve the existing production build locally, normally on port 4173. Run the build first. |

Preview is for local verification, not a production server.
Production hosting must serve `index.html` for client
routes so direct links and refreshes work.

## Existing routes

| Route | Screen |
| --- | --- |
| `/` | Menu cards, add-food dialog, and confirmed removal. |
| `/edit-menu` | Select and edit a menu item by ID; card links preselect it with `?item=<id>`. |
| `/orders` | Incoming orders, preparation status, accept/ready actions, and confirmed decline/deletion. |
| `/profile` | Restaurant details, refresh/error states, and an accessible editing dialog. |
| `/signup` | Customer/restaurant-owner signup UI with validation; live submission unavailable. |
| `/login` | Matching email/password login UI; live submission unavailable. |
| `/restaurant/:restaurantId` | Explicit unfinished-feature notice, restaurant ID, and return link; no restaurant browsing/data request. |
| Any unknown path | Accessible not-found screen with Menu and Orders recovery links. |

The main navigation links to Menu, Orders, and Profile, with a separate Log in
entry. Signup and login link to each other. Open the restaurant placeholder
directly by URL.

Client-side page navigation updates the document title and focuses the new page
heading. Initial direct loads preserve normal keyboard entry through the skip
link; query-only menu selections preserve form focus. Active navigation follows
the router's case/trailing-slash matching.

## Backend limitations

- Menu, order, and profile requests use the configurable public service above.
  Endpoint contracts remain in `src/utils/api.js`; shared transport handles
  timeouts, cancellation, HTTP failures, and JSON syntax errors without retries.
  Interrupted JSON downloads remain network/timeout failures. The current read
  contracts are `GET /item` returning `{ item: { menu: { menuItems: [...] } } }`,
  `GET /orders` returning `{ orders: [...] }`, and `GET /restaurant` returning
  a flat restaurant object. These reads returned HTTP 200 during baseline
  verification; availability and data depend on that external service.
- Menu/profile saves and order mutations make real PATCH/DELETE requests.
  Their persistence and behavior have not been verified. Do not use these
  controls against shared data without intending to change it.
- Legacy signup referenced `http://localhost:3007/restaurant` or `/customers`
  and `http://localhost:3009/register`. Those services have no implementation
  here, read-only probes failed, and no usable registration/login/session
  contract was found. These requests and the client-side email-list check are
  no longer made. Live auth submission is unavailable; no login endpoint is guessed.
- Menu, order, and profile reads surface HTTP, connection, timeout, and
  malformed-response errors with a retry action. Failed requests are distinct
  from genuinely empty or unavailable data.
- Footer contact details and general social links remain sample content;
  verify them before treating them as public business information.
- The root JSON files are sample data, not automatically loaded fallbacks.
  Although `json-server` is declared, no script launches it, and `server.js`
  is empty. No backend, database, or authentication server runs with Vite.
- External food images can fail independently of the frontend or API; one
  image was blocked with `net::ERR_BLOCKED_BY_ORB` during verification.
  Menu images now show an accessible placeholder for missing or failed images.

## Menu management and remaining service constraints

- Add/edit forms validate required names and descriptions, non-negative birr
  prices with at most two decimal places, and optional HTTP(S) image URLs.
  Failed saves retain the draft. Submissions and dialog dismissal are disabled
  while saving; a request times out after 20 seconds.
- Menu dialogs use native modal dialogs for background inertness and keyboard
  focus containment, with initial focus, Escape dismissal when idle, and focus
  restoration. Removal first asks for confirmation and initially focuses the
  non-destructive action.
- Editing and removal use unique IDs, including string IDs, rather than names.
  Missing or ambiguous IDs remain visible but cannot be edited or removed;
  they require correction in the backend data. Same-name foods remain separate
  records. New numeric IDs use the highest existing non-negative numeric ID
  plus one, rather than the array length. IDs are still client-assigned and
  may be reused after deletions; server-generated IDs are a backend follow-up.
- Every mutation first fetches the latest `/item`, then PATCHes the existing
  `{ item: { ...existingItem, menu: { ...existingMenu, menuItems: [...] } } }`
  structure. Nested metadata is retained. The displayed menu changes only after
  a successful HTTP response. The service's PATCH response is not used as a
  new response contract; persistence across reloads has not been verified live.
- Whole-menu replacement cannot prevent concurrent users from overwriting
  changes between that GET and PATCH. Atomic per-item operations, version
  checking, server validation, ownership checks, and safe automatic retries
  require backend support. No new endpoints are assumed here.
- A connection failure during PATCH leaves its outcome uncertain. The UI keeps
  the draft, explains that the change may have reached the service, and does
  not retry automatically. Check the current menu before retrying to avoid
  adding a duplicate.
- Automated API tests mock all requests. Browser add/edit/remove success,
  failure, and duplicate-submission checks use intercepted requests and isolated
  fixture state. Live verification is read-only; no test mutates the live menu.

## Order management and remaining service constraints

- The existing read contract is `GET /orders` returning `{ orders: [...] }`.
  Each record must have a unique string/integer `id`, an `items` array of food
  name strings, a finite non-negative numeric/numeric-string `totalPrice`, and
  a non-empty `status`. Invalid JSON, unexpected wrappers, malformed records,
  and ambiguous IDs produce a visible error rather than an empty list.
- Cards show only the supplied order ID, item names, total price in birr, and
  status. The current contract supplies no quantities, customer, payment, or
  delivery details. Unknown status strings remain visible with actions disabled.

| Current backend status | Available action | Request |
| --- | --- | --- |
| `Pending` | Accept order | `PATCH /orders/:id` with `{ "status": "Accepted" }` |
| `Pending` | Decline order, after confirmation | Same endpoint with `{ "status": "Declined" }` |
| `Accepted` | Mark ready | Same endpoint with `{ "status": "Done" }` |
| `Accepted` | Delete order, after confirmation | `DELETE /orders/:id` |
| `Declined` or `Done` | No further action | None |

- The existing **Order Ready → Done** mapping is retained. `Done` is displayed
  as **Ready**, referring to food preparation. It is not evidence of delivery
  completion. The backend's broader meaning of `Done` remains ambiguous and
  needs clarification before future fulfillment features.
- An order stays unchanged while its action is pending. Repeated actions on
  the same order are blocked; different orders can update independently.
  Destructive confirmations reuse the menu dialog's focus containment, initial
  safe action, Escape dismissal when idle, and focus restoration.
- A successful PATCH/DELETE response is followed by a fresh `GET /orders`.
  The card updates only when that read confirms the requested status or the
  deleted record's absence. No undocumented mutation response body is assumed.
  Verification reads are not mutation retries. Each request has a 20-second
  timeout; a write plus its verification may take up to about 40 seconds.
- If a write fails, the card and actions remain available with an error.
  Connection loss or failed/inconsistent verification leaves the outcome
  uncertain: the service may already have changed the record. Refresh orders
  before deciding whether to retry. Mutations are never retried automatically.
- Deletion removes the record from this list after confirmation. The service's
  permanent retention, audit history, and recovery behavior are unverified.
  Deletion is not an implemented cancellation, refund, or archive workflow.
- The frontend has no server-side version checks, action idempotency guarantee,
  or verified authorization boundaries. Concurrent merchants can change an
  order between reads. Read-back confirmation does not prove durability across
  backend restarts; live mutation persistence remains unverified.
- Order regression tests and browser action checks use isolated/intercepted
  requests for loading, empty, malformed, error/retry, success/failure, and
  duplicate-action cases. Live checks are GET-only and never mutate orders.

## Restaurant profile contract and limitations

- Read-only inspection confirmed a flat `GET /restaurant` response with `id`,
  `name`, `email`, `location`, `openingHours`, and `cuisineType`. No image field
  is exposed; the profile uses derived initials rather than adding image fields.
  Missing values show `Not provided`; null/empty/id-only objects or HTTP 204
  show an unavailable state. Unexpected nested shapes and invalid field types
  are errors, not inferred restaurant data.
- The editor keeps the original five required fields, validates email syntax,
  and leaves opening hours and cuisine as free text. It snapshots the profile
  once; refresh is blocked while editing/saving, and late reads cannot replace
  the draft. Cancel explicitly discards edits. Failed saves retain them.
- The **write contract remains unverified**. Existing code sends
  `PATCH /restaurant` with `{ restaurant: { id, name, email, location,
  openingHours, cuisineType } }` (ID included when supplied by the read).
  This nested payload is retained. A flat GET does not establish a flat PATCH
  contract; the client never probes an alternative payload automatically.
- Save success requires a 2xx response followed by a fresh flat read matching
  all five trimmed fields and the original ID when present. A nested-only echo,
  unchanged/partial data, missing profile, or failed read-back is unconfirmed;
  the draft and previous displayed details remain. No mutation is retried
  automatically. Check the profile before deciding whether to retry an uncertain
  save. Each request times out after 20 seconds (up to about 40 for save/read-back).
- Simulated saves test both successful legacy-payload handling and the mismatch
  where only a nested object changes. They do not prove live write compatibility
  or persistence. Live checks are read-only. Backend documentation/source is
  needed to settle the payload contract; authorization, concurrent editing, and
  durability across restarts remain unverified.

## Signup/login readiness and isolated tests

- `/signup` and `/login` provide labeled fields, appropriate autocomplete,
  required/email/matching-password validation, associated errors, and working
  navigation. Signup preserves Customer/Restaurant Owner as a declared intent;
  it does not grant restaurant permissions. Phone is required without imposing
  an undocumented format. Passwords have no invented length/composition policy.
- **No live authentication capability is connected.** Normal routes show an
  unavailable notice and disabled submission. Even programmatic form submission
  cannot send credentials through the default adapter. There are no auth HTTP
  calls, account creation, sessions, tokens, route guards, or signed-in UI state.
  Existing merchant routes remain accessible as before; frontend navigation
  does not secure merchant data.
- Candidate frontend adapter inputs are `{ name, email, phone, password, role }`
  for signup and `{ email, password }` for login. These are not asserted backend
  contracts. Confirmation and arbitrary authorization/session fields are excluded.
  No transport URL is configured until a real service contract is established.
- Valid submission attempts clear password fields; failures keep non-sensitive
  fields and require re-entry of secrets. Passwords are never logged or persisted
  by the app. Duplicate submissions are blocked while pending. Errors do not
  echo provider messages, and success feedback never claims a session exists.
- Browser fixture: with Vite running, open `/tests/fixtures/auth.html`. It has an
  explicit isolated-test banner and injects an in-memory adapter into the same
  screen component. Its success/failure outcomes create no account, session,
  HTTP request, or credential storage. It records sanitized call metadata only.
  Fixture controls exist only in that test entry; normal routes have no query,
  storage, or environment switch for simulated auth. The production build excludes
  this entry and its fixture code. Browser checks cover pending/duplicate actions,
  failure recovery, password clearing, navigation, errors, and keyboard focus.
- Backend work still needed: documented registration/login responses and error
  contracts, server password policy and credential handling, account uniqueness,
  verified session lifecycle, and server-enforced restaurant membership/owner
  approval. No password reset, social login, or backend authentication is added.

## Frontend reliability verification

- Build, lint, and all 71 isolated regression tests pass. Tests intercept fetch;
  the suite never creates accounts or changes the live service. New coverage
  checks API configuration, interrupted body downloads, and distinct HTTP,
  malformed, timeout, and valid empty responses across all three resources.
- Headless Edge checks cover all routes, including the unknown-route recovery
  screen, at 360, 390, 768, and 1440px. Direct loads, active links, skip-link/page
  focus, associated labels, keyboard navigation, dialog focus/Escape/restoration,
  long content, and horizontal overflow were checked. Vite override and invalid
  configuration cases were verified through actual browser requests.
- Intercepted browser requests cover loading, empty, network/HTTP/malformed
  failures, retry recovery, retained drafts/data, and duplicate menu submission.
  Confirmed menu writes clear an earlier loading error. Long menu prices wrap
  instead of widening cards and the editor.
- Local production preview serves direct routes and unknown-route recovery;
  the auth test entry is absent from built output. Production assets were checked
  for fixture markers and credential patterns. Frontend code is public; this
  check does not establish backend security or authorization.
- On 2026-11-13, GET-only browser checks could read and parse the default live
  menu, orders, and profile. All writes and authentication outcomes were isolated
  simulations. Live write compatibility, persistence, concurrency, and session
  behavior remain unverified. No deployment or real-device/screen-reader audit
  was performed; production hosting still needs an SPA fallback.

Before student browsing begins, settle the supported campus/service area,
restaurant ownership/approval, delivery fulfillment and handoff, currency/payment
methods and fees, and order cancellation/status meanings. A small first release
can target one campus with approved restaurants; other choices require product
agreement and documented backend contracts rather than frontend assumptions.
