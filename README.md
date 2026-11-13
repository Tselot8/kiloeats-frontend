# KiloEats frontend

React 18, React Router 7, and Vite 6 frontend for KiloEats, a university food
delivery project. The existing interface primarily manages restaurant menus,
incoming orders, and restaurant profiles. A separate student demo lets you
browse synthetic restaurants and menus by campus and manage a persisted demo
cart. Checkout and order submission are not implemented.

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
| `npm run test:browsing` | Check demo campus filtering, menu lookup, availability, invalid links, isolated snapshots, and cancellation. |
| `npm run test:cart` | Check quantities, integer money, replacement confirmation, restoration, catalog changes, and storage failures. |
| `npm run test:identity` | Check identity/route rules, verification states, safe returns, student-only signup payloads, and isolated role-network behavior. |
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
| `/signup` | Student registration UI with one of the four campuses; live submission unavailable. |
| `/login` | Matching email/password login UI; live submission unavailable. |
| `/browse?campus=<id>` | Student restaurant discovery with URL-based campus selection and explicit demo data. |
| `/restaurant/:restaurantId?campus=<id>` | Student sample menu, campus coverage, availability, and campus-preserving return link. |
| `/cart` | Single-restaurant/campus demo cart, quantities, removals, food subtotal, and unquoted delivery fee. |
| `/account` | Student account and verification status; student identity required. |
| `/admin` | Reserved admin placeholder; admin identity required. No review dashboard. |
| Any unknown path | Accessible not-found screen with public browsing/cart recovery, or Menu/Orders for assigned staff. |

Navigation follows the current frontend identity: public browsing/cart for
everyone, student account for students, Menu/Orders/Profile for assigned staff,
and the reserved admin entry for admins. Shared login remains unavailable.
Frontend gates prevent denied components from mounting; they do not secure the
backend or establish restaurant ownership. Normal operation is always guest.

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
  navigation. Signup registers student intent and requires an agreed campus;
  there is no public role selector. Restaurant/admin access must be provisioned
  by the platform. Phone is required without imposing
  an undocumented format. Passwords have no invented length/composition policy.
- **No live authentication capability is connected.** Normal routes show an
  unavailable notice and disabled submission. Even programmatic form submission
  cannot send credentials through the default adapter. There are no auth HTTP
  calls, account creation, sessions, tokens, or real signed-in state. Frontend
  route gates now show login-required/access-denied states and leave denied
  merchant components unmounted, so those visits issue no merchant requests.
- Candidate frontend adapter inputs are `{ name, email, phone, password, campusId }`
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

- Build, lint, and all 129 isolated regression tests pass. Tests intercept fetch;
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

## Student browsing demo and remaining decisions

- Start at `/browse`. No campus is assumed until selected. Supported URL IDs are
  `aau-4k` (AAU 4K), `aau-5k` (AAU 5K), `aau-6k` (AAU 6K), and
  `yared-music-school` (Yared Music School). Selection lives in `?campus=`, with
  normal history entries; refresh, back/forward, restaurant links, and return
  links preserve it. A direct restaurant URL without a campus asks you to choose.
- Example: `/restaurant/demo-acacia-kitchen?campus=aau-4k`. All five restaurants,
  food availability, descriptions, and ETB food prices are synthetic. Local SVG
  illustrations are illustrative, not restaurant photos. No real partnerships,
  approval, live availability, deliveries, ratings, reviews, distances, or exact
  delivery fees are claimed. Missing/failed images use the existing fallback.
- `src/data/demoRestaurants.js` is the catalog. The small asynchronous read
  boundary in `src/utils/studentBrowsing.js` exposes `listRestaurants` and
  `getRestaurantMenu`, returns independent snapshots, and honours abort signals.
  It has no HTTP transport, writes, persistence, or dependency on the merchant
  API setting. Replace that boundary when a supported student backend exists;
  these client data shapes are not an asserted backend contract.
- Unsupported campuses, unknown restaurant IDs, unsupported campus/restaurant
  combinations, empty menus, and unavailable menus have separate recovery
  states. Unavailable foods stay visible and labeled and cannot be added to the
  cart. Checkout, order submission, live authentication, maps, and geolocation
  are not implemented.
- `tests/fixtures/browsing.html` is a separate development-only test entry for
  empty discovery, failed/deferred reads, explicit retries, and stale-result
  handling. Normal routes cannot enable its controls through query parameters
  or storage. The production build includes the intentional browsing demo data
  and excludes both browser test harnesses. Browser regression checks use
  intercepted merchant GETs; no live writes or credentials are sent.
- Agreed future product rules: the four campuses above; manually approved
  restaurants with staff-managed menus; restaurant-managed delivery and cash on
  delivery in ETB; students may cancel before acceptance. Future statuses are
  Pending → Accepted → Ready → Delivered, with Declined and Cancelled separate.
  The legacy merchant endpoints and **Order Ready → Done** mapping are unchanged.
- Before cart/checkout, define exact distance bands/fees (every fee must be
  strictly below 100 ETB), how distance is established without guessing, supported
  campus drop-off points and handoff/contact rules, and how/when a fee is quoted.
  Establish documented student read/order contracts, server approval/membership
  enforcement, and cancellation/acceptance race handling. No operational pricing
  formula or new order-state API is implemented here.

## Demo cart

- Available sample foods can be added from a campus-specific menu. `/cart`
  shows the restaurant, campus, unit prices, positive whole-number quantities,
  line totals, and **food subtotal** in ETB. Quantities can be updated, individual
  items removed, and the cart cleared after confirmation. There is no checkout
  action; delivery is **not yet quoted**, not assumed free or included in a final
  payable total.
- One cart holds one restaurant and one campus. Adding from either a different
  restaurant or campus asks before replacing all items. Cancel/Escape preserves
  the original cart; confirmation rechecks the selected food and adds it once.
  Browsing another campus alone never changes the cart. Clearing returns focus
  to the cart heading when its original button is removed.
- `src/utils/cart.js` owns validation, minor-unit arithmetic, restoration, and
  the reducer. `src/context/CartProvider.jsx` supplies a small React context.
  Values use integer minor units (100 per ETB), safe integer quantities/totals,
  and prices with at most two decimal places. Invalid/overflowing values are
  rejected; current item IDs, names, prices, and availability come from the demo
  catalog, not caller-provided item metadata.
- Only the versioned, non-sensitive cart is saved under
  `kiloeats.demoCart.v1`: restaurant/campus/item IDs, quantities, last-known food
  names, and unit prices in minor units. No credentials, session data, delivery
  addresses, or other storage keys are read or written. On refresh, records are
  checked against the catalog; malformed/duplicate/missing/unavailable entries
  are removed with visible notices, and repricing shows the old/new unit price
  before the recalculated subtotal is used. Saved metadata never overrides the
  catalog. Sanitized results are saved back when storage permits.
- If storage cannot be read, this tab uses an in-memory cart and avoids
  overwriting unreadable saved data. Save/clear failures retain the usable
  in-memory state and warn that refresh may restore an older cart. Storage
  persistence is best-effort and carts are not synchronized between open tabs.
  Browser harnesses use separate in-memory adapters, not the normal cart key.
- Tests and browser checks use only the local demo catalog, seeded non-sensitive
  cart data, isolated storage failures, and intercepted merchant GETs. Cart
  operations send no API requests. Headless Edge journey, keyboard/focus, and
  replacement/cancel checks passed at 360, 390, 768, and 1440px in development
  and production preview. Development checks also verified refresh, restoration
  notices, and storage failures. Live auth, price/availability guarantees,
  server validation, and order creation remain unimplemented. Checkout still
  needs agreed distance bands/fees below 100 ETB, campus drop-offs/handoff,
  fee quotation timing, and supported student authentication/order contracts.

## Identity, route access, and proposed student verification

`src/utils/identity.js` defines a frontend adapter shape; it is not an asserted
backend session endpoint. `IdentityProvider` supports loading, ready guest,
student, assigned restaurant staff, admin, and unavailable/unknown identity.
The normal adapter resolves guest without a network call. URL parameters,
local-storage roles, and signup values cannot create a session or enable roles.
There is no automatic successful-login redirect. A future server identity must
choose an authorized destination; return paths are limited to known internal
routes and non-sensitive campus/item query parameters.

| Routes | Guest | Student (any verification state) | Assigned restaurant staff | Admin |
| --- | --- | --- | --- | --- |
| `/browse`, `/restaurant/:id`, `/cart`, `/login`, `/signup` | Public | Public | Public | Public |
| `/account` | Login required | Allowed | Denied | Denied |
| `/`, `/edit-menu`, `/orders`, `/profile` | Login required | Denied | Allowed | Denied |
| `/admin` | Login required | Denied | Denied | Placeholder allowed |

Loading/unknown/failed identity never opens protected components. Public
browsing/cart remain usable. Staff require a non-empty assigned restaurant ID,
displayed in the header. **This is frontend behavior, not backend security.**
The legacy merchant API remains global/unscoped and unchanged; an assignment
label and hidden navigation do not enforce ownership or protect raw endpoints.
Do not connect a real staff session until the backend can enforce that mapping.

The student account page shows Not submitted, Pending, Verified, and Rejected,
including a supplied rejection reason and future resubmission guidance. Only
verified student identity is marked as future order-eligible; no state enables
checkout or order submission here. University-email verification and manual
student-ID review are **proposals**: no approved domains, enrollment guarantee,
review timeframe, upload endpoint, or email ownership flow is invented. Email
control alone does not establish current enrollment. Live verification is
unavailable, with no file input or real evidence collection/storage.

With Vite running, `/tests/fixtures/roles.html` demonstrates all identities,
verification states, failed/loading identity, and synthetic submission and
resubmission. It mounts the same application routes. Its fetch implementation
is installed before merchant components mount and resolves known merchant reads
and writes entirely in memory, rejecting every other fetch without a network
fallback. All records and submissions are synthetic. There is no normal-route
query/environment/storage switch for these roles. This entry, network mock,
and role controls are excluded from production. Existing browser harnesses use
guest identity and their own in-memory cart storage.

Headless Edge checks covered guest/student/staff/admin navigation, direct URL
gates, all verification states, failed and duplicate synthetic submissions,
keyboard focus, and overflow at 360, 390, 768, and 1440px. Guest gates were also
checked in production preview. Denied visits made zero merchant requests;
authorized fixture writes stayed in memory. No real credentials or IDs were
sent. Physical-device and screen-reader audits remain unperformed.

Backend work still required: a documented session contract/lifecycle; server-
enforced roles, staff provisioning and restaurant ownership on every request;
student enrollment eligibility/expiry and re-verification rules; approved email
policy; accepted ID/evidence types; authorized reviewers, rejection/resubmission
and appeal rules; private evidence upload/storage/access; and retention/deletion
policy. No real IDs, credentials, or live writes are used to demonstrate these
screens. Admin review tools belong to a later milestone.
