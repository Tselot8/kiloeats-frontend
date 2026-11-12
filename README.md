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
| `npm run preview` | Serve the existing production build locally, normally on port 4173. Run the build first. |

There is currently no automated test script. Preview is for local verification,
not a production server. Production hosting must serve `index.html` for client
routes so direct links and refreshes work.

## Existing routes

| Route | Screen |
| --- | --- |
| `/` | Restaurant menu, add-food dialog, and removal controls. |
| `/edit-menu` | Select and edit an existing menu item. |
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
- Several failed reads fall back to empty arrays/objects, so an empty menu,
  no orders, or `N/A` profile fields do not establish that the backend has no
  data. Check browser Network and Console panels when diagnosing failures.
- The root JSON files are sample data, not automatically loaded fallbacks.
  Although `json-server` is declared, no script launches it, and `server.js`
  is empty. No backend, database, or authentication server runs with Vite.
- External food images can fail independently of the frontend or API; one
  image was blocked with `net::ERR_BLOCKED_BY_ORB` during verification.
  Detailed page-specific layout and accessibility improvements remain for later milestones.
