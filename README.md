# MusicVerse — WEB700 Project Part 3 (Complete)

An Express.js backend that serves both a JSON API and HTML/EJS pages,
migrated from a local JSON dataset (Part 2) to a **Neon (managed Postgres)
database via Sequelize**, with full CRUD, an HTML insert/edit workflow,
and a health endpoint (Part 3).

**Team:** Maharshi Darji & Om Surani

## What's included in this Part 3 (Complete) version

- Sequelize + `config/database.js` connection to Neon.
- `models/Track.js` mapping to the `tracks` table.
- `scripts/migrate.js` — creates the table and loads `data/tracks.json`.
- `services/trackDbService.js` — full DB-backed data-access layer:
  Create, Read (list + by id + search), Update, Delete.
- **All** routes now read from / write to Postgres. `data/tracks.json` is
  only used as seed data for `scripts/migrate.js` — it is never read at
  request time.
- HTML pages: `/items/new` (insert form), `/items/:id/edit` (edit form),
  delete button with a confirmation dialog on the detail page.
- `GET /api/health` — confirms the deployed app can reach Neon.
- **Custom cover art:** the add/edit track form has an optional "Cover
  Image URL" field. If you paste a direct image link, that image is used
  as the track's cover everywhere (listing, detail page, API). Leave it
  blank and the app falls back to its existing auto-fetched real cover
  art, then a genre icon, exactly as before.
- Centralized error handling (JSON for `/api/*`, EJS `404`/`500` pages
  otherwise); no stack traces or raw DB errors are ever shown to users.

## Getting Started (VS Code)

1. Open this folder in VS Code (`File > Open Folder...`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your **real Neon connection
   string** (Neon dashboard -> your project -> Connect -> pooled connection,
   must include `?sslmode=require`):
   ```bash
   cp .env.example .env
   ```
4. Load the dataset into Postgres (creates the `tracks` table and inserts
   the 200 sample records):
   ```bash
   npm run migrate
   ```
5. Start the server:
   ```bash
   npm start
   ```
   or, for auto-restart on file changes during development:
   ```bash
   npm run dev
   ```
6. Visit **http://localhost:3000** in your browser.

> `npm run migrate` uses `sequelize.sync({ force: true })`, so it's safe to
> re-run any time you want to reset the table back to the sample dataset.
> Do **not** run it against a production database with real user-added
> data you want to keep.

## Project Structure

```
musicverse-part3/
├── config/
│   └── database.js          # Sequelize connection to Neon (reads DATABASE_URL)
├── models/
│   └── Track.js              # Sequelize model -> "tracks" table
├── scripts/
│   └── migrate.js            # one-off JSON -> Postgres migration
├── data/
│   └── tracks.json           # original 200-record sample (seed data only)
├── public/
│   ├── css/style.css
│   ├── images/covers/
│   └── js/
├── routes/
│   ├── apiRoutes.js         # JSON API routes  (mounted at /api)
│   └── webRoutes.js         # HTML/EJS routes  (mounted at /)
├── services/
│   ├── trackService.js       # legacy JSON-backed logic (no longer used at request time)
│   └── trackDbService.js     # DB-backed logic - used by every route
├── views/
│   ├── partials/            # header.ejs, footer.ejs
│   ├── index.ejs
│   ├── items.ejs
│   ├── item-detail.ejs
│   ├── item-form.ejs        # shared insert/edit form
│   ├── search.ejs
│   ├── results.ejs
│   └── 404.ejs / 500.ejs
├── .env.example
├── server.js
└── package.json
```

## Routes

| Method | Route | Output | Description |
|---|---|---|---|
| GET | `/` | HTML | Home page |
| GET | `/items` | HTML | Track listing (`?genre=`, `?sortBy=popularity\|danceability`) |
| GET | `/items/new` | HTML form | Insert form |
| POST | `/items/new` | Redirect | Validates + inserts a new track |
| GET | `/items/:id` | HTML | Track detail page |
| GET | `/items/:id/edit` | HTML form | Edit form, pre-populated |
| POST | `/items/:id/edit` | Redirect | Validates + updates the track |
| POST | `/items/:id/delete` | Redirect | Deletes the track (confirmed in UI) |
| GET | `/search` | HTML | Search form |
| POST | `/search` | HTML | Search results (field: `keyword`) |
| GET | `/api/items` | JSON | All tracks (`?genre=`, `?minPopularity=`, `?sortBy=`) |
| POST | `/api/items` | JSON | Create a track |
| GET | `/api/items/:id` | JSON | One track by id |
| PATCH | `/api/items/:id` | JSON | Update a track |
| DELETE | `/api/items/:id` | JSON | Delete a track |
| GET | `/api/search?keyword=` | JSON | Search tracks |
| GET | `/api/genres` | JSON | Distinct list of genres |
| GET | `/api/health` | JSON | Confirms DB connectivity |

`/items/:id`, `/items/:id/edit`, `/items/:id/delete`, `/api/items/:id` are
**dynamic routes** — `:id` is a route parameter captured into
`req.params.id`. Every other route is a **static route**, several of
which also read query strings (`?genre=`, `?keyword=`, etc.) or a request
body (`req.body`).

## JSON → PostgreSQL Field Mapping

| Part 2 JSON field | Postgres column | Notes |
|---|---|---|
| `id` | `id` (PK, serial) | |
| `genre` | `genre` | |
| `artist_name` | `artist_name` | |
| `track_name` | `track_name` | |
| `track_id` | `track_id` | Spotify's original track id, kept for reference |
| `popularity` | `popularity` | integer, 0–100 |
| `duration_ms` | `duration_ms` | integer |
| `audioFeatures.acousticness` … `valence` | flattened columns (`acousticness`, `danceability`, …) | Nested object flattened into real columns — see §5.2 of the assignment (flattening is the chosen strategy since each feature is queried/sorted independently) |
| `audioFeatures.key` | `key` | |
| `audioFeatures.mode` | `mode` | |
| `audioFeatures.time_signature` | `time_signature` | |

`services/trackDbService.js`'s `toApiShape()` reshapes each flat row back
into the original `{ ...track, audioFeatures: {...} }` JSON structure so
the EJS views and API responses didn't need to change.

## Error Handling

- Every route handler wraps its logic in try/catch (routes that hit the
  database are `async` functions). Expected situations (record not found,
  empty search keyword, invalid popularity) return a normal `404`/`400`
  response with a clear message.
- Anything unexpected (including database connection errors) gets passed
  to `next(err)`, which routes to the centralized error-handling
  middleware in `server.js`.
- That middleware logs the error server-side and responds with **JSON**
  for `/api/...` requests or a rendered **`views/500.ejs`** page for
  everything else. Database passwords, connection strings, and stack
  traces are never sent to the client.

## Verifying in pgAdmin

After `npm run migrate`, connect pgAdmin to the same Neon connection
string and check:
- `tracks` table exists with 200+ rows.
- After a `POST /items/new` (or `POST /api/items`), a new row appears.
- After a `POST /items/:id/edit` (or `PATCH /api/items/:id`), the edited
  row's values changed.
- After a delete, the row is gone.

## Deployment (Vercel)

1. Push this code to the shared GitHub repository.
2. Import the repository into Vercel.
3. Add `DATABASE_URL` (the Neon **pooled** connection string) as a Vercel
   production environment variable.
4. Deploy / redeploy.
5. Test `/api/health`, `/items`, `/api/items` on the live URL, then run one
   full create → update → delete cycle against production and confirm
   each change in pgAdmin.

**Deployed URL:** _add your Vercel URL here once deployed_

## Known Limitations

- No authentication yet — every visitor can create/edit/delete tracks.
  This is addressed in Part 4 (admin login + protected routes).
- `services/trackService.js` (the original JSON-backed logic) is kept in
  the repo for reference but is no longer called by any route.

## Team Contributions

- **Maharshi Darji:** Sequelize model/config, migration script, DB-backed
  API routes (CRUD + health), search migration.
- **Om Surani:** DB-backed web routes (insert/edit/delete forms), views,
  Neon/pgAdmin verification, README/report documentation.
