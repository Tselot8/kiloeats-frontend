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

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload. |
| `npm run build` | Build production assets into `dist/`. |
| `npm run lint` | Check JavaScript and JSX with ESLint. |
| `npm run test:menu` | Run isolated menu API and validation regression tests with Node's built-in test runner. No live requests are made. |
| `npm run preview` | Serve the existing production build locally, normally on port 4173. Run the build first. |

Preview is for local verification, not a production server.
Production hosting must serve `index.html` for client
routes so direct links and refreshes work.

## Existing routes

| Route | Screen |
| --- | --- |
| `/` | Menu cards, add-food dialog, and confirmed removal. |
| `/edit-menu` | Select and edit a menu item by ID; card links preselect it with `?item=<id>`. |
| `/orders` | Incoming orders with accept, decline, ready, and delete actions. |
| `/profile` | Restaurant profile and edit dialog. |
| `/signup` | Incomplete customer/restaurant-owner signup form. |
| `/restaurant/:restaurantId` | Placeholder displaying the restaurant ID, for example `/restaurant/1`. |

The main navigation links to Menu, Orders, and Profile. Open signup and the
restaurant placeholder directly by URL.

## Backend limitations

- Menu, order, and profile requests use the hard-coded base URL
  `https://kilo-eats-backend.onrender.com` in `src/utils/api.js`. The current read
  contracts are `GET /item` returning `{ item: { menu: { menuItems: [...] } } }`,
  `GET /orders` returning `{ orders: [...] }`, and `GET /restaurant` returning
  a flat restaurant object. These reads returned HTTP 200 during baseline
  verification; availability and data depend on that external service.
- Menu/profile saves and order mutations make real PATCH/DELETE requests.
  Their persistence and behavior have not been verified. Do not use these
  controls against shared data without intending to change it.
- Signup separately calls `http://localhost:3007/restaurant` or `/customers`,
  then posts to `http://localhost:3009/register`. Those services are not
  included or started here; read-only probes to `/customers` and `/register`
  refused connections during verification.
- Signup also validates a password-confirmation value without rendering its
  input, so valid-password submissions cannot pass that check. The login
  button has no action. Authentication and route protection are not implemented.
- Menu reads now surface HTTP, connection, timeout, and malformed-response
  errors with a retry action. Order/profile helpers still fall back to empty
  arrays/objects on some failures; no orders or `N/A` profile fields do not
  establish that the backend has no data.
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
