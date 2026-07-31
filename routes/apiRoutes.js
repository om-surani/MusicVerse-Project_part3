// routes/apiRoutes.js
// JSON API routes -> mounted at /api in server.js
//
// Routing cheat-sheet for this file:
//   GET    /api/items          static route  (DB SELECT)
//   POST   /api/items          static route  (DB INSERT)
//   GET    /api/items/:id      dynamic route (DB SELECT)
//   PATCH  /api/items/:id      dynamic route (DB UPDATE)  - Part 3 completion
//   DELETE /api/items/:id      dynamic route (DB DELETE)  - Part 3 completion
//   GET    /api/search         static route  (DB SELECT, was JSON-file, now migrated)
//   GET    /api/genres         static route  (DB SELECT DISTINCT)
//   GET    /api/health         static route  (DB connectivity check)     - Part 3 completion
//
// Every route in this file reads from / writes to the Neon Postgres
// "tracks" table via services/trackDbService.js. data/tracks.json is no
// longer read at request-time anywhere in this app - it's only used as
// seed data for scripts/migrate.js.
//
// Every handler is wrapped in try/catch. If something throws (bad data,
// unexpected shape, a DB connection problem, etc.) we call next(err)
// instead of letting the request hang - that hands the error off to the
// centralized error-handling middleware in server.js, which sends back a
// clean JSON error response.

const express = require("express");
const router = express.Router();
const trackDbService = require("../services/trackDbService");
const sequelize = require("../config/database");

// GET /api/items?genre=Pop&minPopularity=50&sortBy=popularity
// Static route. Returns all records from the Neon "tracks" table
// (optionally filtered/sorted via query string). DB SELECT.
router.get("/items", async (req, res, next) => {
  try {
    const { genre, minPopularity, sortBy } = req.query;
    const items = await trackDbService.getAllTracksDb({
      genre,
      minPopularity,
      sortBy,
    });
    res.json(items);
  } catch (err) {
    next(err); // hand off to the centralized error handler
  }
});

// POST /api/items
// Static route. Creates a new track record in the Neon "tracks" table.
// DB INSERT.
// Expected JSON body:
// {
//   "genre": "Pop", "artist_name": "...", "track_name": "...",
//   "popularity": 50, "duration_ms": 200000,
//   "audioFeatures": { "danceability": 0.5, ... }
// }
router.post("/items", async (req, res, next) => {
  try {
    const { genre, artist_name, track_name, popularity } = req.body;

    if (!genre?.trim() || !artist_name?.trim() || !track_name?.trim()) {
      return res.status(400).json({
        error: "genre, artist_name, and track_name are required.",
      });
    }
    if (
      popularity !== undefined &&
      (isNaN(Number(popularity)) || Number(popularity) < 0 || Number(popularity) > 100)
    ) {
      return res.status(400).json({ error: "popularity must be a number between 0 and 100." });
    }

    const created = await trackDbService.createTrackDb({
      ...req.body,
      genre: genre.trim(),
      artist_name: artist_name.trim(),
      track_name: track_name.trim(),
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id
// Dynamic route - ":id" is a route parameter, available as req.params.id.
// DB SELECT.
router.get("/items/:id", async (req, res, next) => {
  try {
    const item = await trackDbService.getTrackByIdDb(req.params.id);
    if (!item) {
      // Expected/"handled" error: 404, not a server crash.
      return res
        .status(404)
        .json({ error: `No track found with id "${req.params.id}"` });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/items/:id
// Dynamic route. Updates an existing track. DB UPDATE.
// Part 3 completion (full CRUD requirement).
router.patch("/items/:id", async (req, res, next) => {
  try {
    const { popularity } = req.body;
    if (
      popularity !== undefined &&
      (isNaN(Number(popularity)) || Number(popularity) < 0 || Number(popularity) > 100)
    ) {
      return res.status(400).json({ error: "popularity must be a number between 0 and 100." });
    }

    const updated = await trackDbService.updateTrackDb(req.params.id, req.body);
    if (!updated) {
      return res
        .status(404)
        .json({ error: `No track found with id "${req.params.id}"` });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/items/:id
// Dynamic route. Deletes a track. DB DELETE.
// Part 3 completion (full CRUD requirement).
router.delete("/items/:id", async (req, res, next) => {
  try {
    const deleted = await trackDbService.deleteTrackDb(req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ error: `No track found with id "${req.params.id}"` });
    }
    res.json({ message: `Track ${req.params.id} deleted.` });
  } catch (err) {
    next(err);
  }
});

// GET /api/search?keyword=value
// Static route. Search records against artist_name, track_name, genre.
// Now reads from Postgres (was data/tracks.json in Phase 1).
router.get("/search", async (req, res, next) => {
  try {
    const { keyword } = req.query;
    if (!keyword || keyword.trim() === "") {
      return res
        .status(400)
        .json({ error: "Please provide a ?keyword= query parameter" });
    }
    const results = await trackDbService.searchTracksDb(keyword.trim());
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/genres
// Static route. Distinct list of genres, read from the DB. DB SELECT.
router.get("/genres", async (req, res, next) => {
  try {
    const genres = await trackDbService.getGenresDb();
    res.json(genres);
  } catch (err) {
    next(err);
  }
});

// GET /api/health
// Static route. Confirms the deployed application can reach Neon.
// Part 3 completion (required health/status endpoint).
router.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", database: "unreachable" });
  }
});

module.exports = router;
