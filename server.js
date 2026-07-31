// server.js
// WEB700 Project Part 2 - MusicVerse
// Express backend serving a JSON API and EJS/HTML pages over a local
// Spotify-style tracks dataset (data/tracks.json).
//
// ---- Routing overview ----
// This app is split into two routers (see routes/):
//   apiRoutes.js  (mounted at /api)  -> JSON routes for data/testing
//   webRoutes.js  (mounted at /)     -> HTML/EJS routes for people
// Both use a mix of GET and POST, and both use static routes
// (e.g. /items) and dynamic routes with a route parameter (e.g. /items/:id).
//
// ---- Error handling overview ----
// 1. Route handlers wrap their logic in try/catch and call next(err) on
//    failure instead of throwing - Express then skips straight to the
//    error-handling middleware below.
// 2. A "no route matched" 404 handler runs if nothing above it matched.
// 3. A final 4-arg error-handling middleware catches anything passed to
//    next(err) and returns a clean JSON or HTML error response depending
//    on whether the request was for /api or a page.

const express = require("express");
const path = require("path");

const sequelize = require("./config/database");
const Track = require("./models/Track");
const apiRoutes = require("./routes/apiRoutes");
const webRoutes = require("./routes/webRoutes");
const tracksData = require("./data/tracks.json");
const { warmCoverArtCache } = require("./services/coverArtService");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- View engine ----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---- Middleware ----
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true })); // parse HTML form submissions (POST)
app.use(express.json()); // parse JSON request bodies (for future POST/PUT to the API)

// ---- Routes ----
app.use("/api", apiRoutes); // GET/POST-style JSON routes: /api/items, /api/items/:id, /api/search, /api/genres
app.use("/", webRoutes); // GET + POST HTML routes: /, /items, /items/:id, /search (GET + POST)

// ---- 404 handler: no route matched this request at all ----
// Content-negotiated: API callers get JSON, browsers get the EJS 404 page.
app.use((req, res) => {
  const wantsJson =
    req.originalUrl.startsWith("/api") || req.accepts(["html", "json"]) === "json";

  if (wantsJson) {
    return res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
  }
  res.status(404).render("404", { title: "Page Not Found" });
});

// ---- Centralized error-handling middleware ----
// Must have exactly 4 params so Express recognizes it as an error handler.
// Anything passed to next(err) anywhere above ends up here.
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.originalUrl} ->`, err.stack || err);

  const status = err.status || 500;
  const message = err.message || "Something went wrong on the server.";

  const wantsJson =
    req.originalUrl.startsWith("/api") || req.accepts(["html", "json"]) === "json";

  if (wantsJson) {
    return res.status(status).json({ error: message });
  }
  res.status(status).render("500", { title: "Server Error", message });
});

// ---- Startup: verify the database is reachable before accepting traffic ----
// This is what used to cause `relation "tracks" does not exist` 500 errors
// on every page: the server would start even if `npm run migrate` had never
// been run. Now we check first and fail fast with a clear message instead.
async function start() {
  try {
    await sequelize.authenticate();

    // sync() (no force/alter) creates the "tracks" table if it's missing,
    // but never touches or drops an existing table - safe to run every
    // startup. It does NOT insert any data; that's still migrate.js's job.
    await sequelize.sync();

    // sync() alone won't add new columns to a table that already exists
    // (e.g. after pulling this update on a database that was migrated
    // before the cover_image_url column existed). This is a no-op/safe
    // to run every startup, and it preserves existing rows instead of
    // requiring a destructive `npm run migrate` re-run.
    await sequelize.query(
      `ALTER TABLE IF EXISTS tracks ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(255);`
    );

    const count = await Track.count();
    if (count === 0) {
      console.warn(
        '[startup] The "tracks" table is empty. Run `npm run migrate` in ' +
          "another terminal to load the sample dataset."
      );
    }
  } catch (err) {
    console.error(
      "[startup] Could not connect to the database:",
      err.message
    );
    console.error(
      "[startup] Check that DATABASE_URL in .env is correct, then run " +
        "`npm run migrate` before starting the server again."
    );
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`MusicVerse server running at http://localhost:${PORT}`);
  });

  // Fetch each track's REAL cover/single art (Deezer, then iTunes as a
  // fallback) in the background and cache it to data/coverArt.json.
  // Not awaited on purpose: the site is usable immediately with the old
  // genre icons, and pages start showing real photos (on refresh) as
  // the lookups complete. Safe to skip entirely if there's no internet
  // connection - it just logs a warning and every track keeps its
  // genre icon.
  warmCoverArtCache(tracksData).catch((err) => {
    console.warn("[startup] Could not fetch cover art:", err.message);
  });
}

start();
