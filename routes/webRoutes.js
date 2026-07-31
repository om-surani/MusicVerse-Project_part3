// routes/webRoutes.js
// HTML/EJS routes -> mounted at / in server.js
//
// Routing cheat-sheet for this file:
//   GET  /                  static route  -> home page
//   GET  /items              static route  -> track listing (DB SELECT)
//   GET  /items/new           static route  -> show insert form           - Part 3 completion
//   POST /items/new           static route  -> process insert form (DB INSERT) - Part 3 completion
//   GET  /items/:id           dynamic route -> track detail (DB SELECT)
//   GET  /items/:id/edit       dynamic route -> show edit form (DB SELECT)      - Part 3 completion
//   POST /items/:id/edit       dynamic route -> process edit form (DB UPDATE)   - Part 3 completion
//   POST /items/:id/delete     dynamic route -> process delete (DB DELETE)      - Part 3 completion
//   GET  /search              static route  -> show the search form
//   POST /search              static route  -> process the search form (DB SELECT)
//
// Every route reads from / writes to the Neon Postgres "tracks" table via
// services/trackDbService.js. data/tracks.json is no longer read at
// request-time anywhere in this app.
//
// Every handler is wrapped in try/catch and forwards unexpected errors to
// next(err), which routes them into the centralized error-handling
// middleware defined in server.js.

const express = require("express");
const router = express.Router();
const trackDbService = require("../services/trackDbService");

// GET / -> Home page with project name and description
router.get("/", async (req, res, next) => {
  try {
    const items = await trackDbService.getAllTracksDb();
    res.render("index", {
      title: "MusicVerse | Home",
      totalTracks: items.length,
    });
  } catch (err) {
    next(err);
  }
});

// GET /items -> Display records in a readable page (static route). DB SELECT.
// NOTE: this must be declared before "/items/:id" so "/items/new" doesn't
// get captured by the ":id" dynamic route.
router.get("/items", async (req, res, next) => {
  try {
    const { genre, sortBy } = req.query;
    const items = await trackDbService.getAllTracksDb({ genre, sortBy });
    const genres = await trackDbService.getGenresDb();
    res.render("items", {
      title: "MusicVerse | Track Listing",
      items,
      genres,
      selectedGenre: genre || "",
      sortBy: sortBy || "",
    });
  } catch (err) {
    next(err);
  }
});

// GET /items/new -> show the insert form.
// Part 3 completion: this is the required user-facing HTML insert form
// (previously only a JSON POST existed).
router.get("/items/new", (req, res) => {
  res.render("item-form", {
    title: "MusicVerse | Add Track",
    formAction: "/items/new",
    item: null,
    error: null,
  });
});

// POST /items/new -> validate + insert a new record into Postgres,
// then redirect to the new track's detail page.
router.post("/items/new", async (req, res, next) => {
  try {
    const { genre, artist_name, track_name, popularity, duration_ms, cover_image_url } = req.body;

    if (!genre?.trim() || !artist_name?.trim() || !track_name?.trim()) {
      return res.render("item-form", {
        title: "MusicVerse | Add Track",
        formAction: "/items/new",
        item: req.body, // preserve entered values on validation failure
        error: "Genre, artist name, and track name are required.",
      });
    }
    if (
      popularity !== undefined &&
      popularity !== "" &&
      (isNaN(Number(popularity)) || Number(popularity) < 0 || Number(popularity) > 100)
    ) {
      return res.render("item-form", {
        title: "MusicVerse | Add Track",
        formAction: "/items/new",
        item: req.body,
        error: "Popularity must be a number between 0 and 100.",
      });
    }

    const created = await trackDbService.createTrackDb({
      genre: genre.trim(),
      artist_name: artist_name.trim(),
      track_name: track_name.trim(),
      popularity: Number(popularity) || 0,
      duration_ms: Number(duration_ms) || 0,
      cover_image_url: cover_image_url?.trim() || "",
    });
    res.redirect(`/items/${created.id}`);
  } catch (err) {
    next(err);
  }
});

// GET /items/:id -> Track detail page (dynamic route). DB SELECT.
router.get("/items/:id", async (req, res, next) => {
  try {
    const item = await trackDbService.getTrackByIdDb(req.params.id);
    if (!item) {
      // Expected/"handled" error: render a friendly 404, not a crash.
      return res.status(404).render("404", { title: "Track Not Found" });
    }
    res.render("item-detail", {
      title: `MusicVerse | ${item.track_name}`,
      item,
    });
  } catch (err) {
    next(err);
  }
});

// GET /items/:id/edit -> show the edit form, pre-populated. DB SELECT.
// Part 3 completion.
router.get("/items/:id/edit", async (req, res, next) => {
  try {
    const item = await trackDbService.getTrackByIdDb(req.params.id);
    if (!item) return res.status(404).render("404", { title: "Track Not Found" });
    res.render("item-form", {
      title: `MusicVerse | Edit ${item.track_name}`,
      formAction: `/items/${item.id}/edit`,
      item,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /items/:id/edit -> validate + persist changes. DB UPDATE.
// Part 3 completion.
router.post("/items/:id/edit", async (req, res, next) => {
  try {
    const { popularity } = req.body;
    if (
      popularity !== undefined &&
      popularity !== "" &&
      (isNaN(Number(popularity)) || Number(popularity) < 0 || Number(popularity) > 100)
    ) {
      return res.render("item-form", {
        title: "MusicVerse | Edit Track",
        formAction: `/items/${req.params.id}/edit`,
        item: { id: req.params.id, ...req.body },
        error: "Popularity must be a number between 0 and 100.",
      });
    }

    const updated = await trackDbService.updateTrackDb(req.params.id, req.body);
    if (!updated) return res.status(404).render("404", { title: "Track Not Found" });
    res.redirect(`/items/${updated.id}`);
  } catch (err) {
    next(err);
  }
});

// POST /items/:id/delete -> confirm existence + delete. DB DELETE.
// The confirmation step happens in the UI (item-detail.ejs uses a
// confirm() dialog before submitting this form).
// Part 3 completion.
router.post("/items/:id/delete", async (req, res, next) => {
  try {
    const deleted = await trackDbService.deleteTrackDb(req.params.id);
    if (!deleted) return res.status(404).render("404", { title: "Track Not Found" });
    res.redirect("/items");
  } catch (err) {
    next(err);
  }
});

// GET /search -> Display a search form
router.get("/search", (req, res, next) => {
  try {
    res.render("search", { title: "MusicVerse | Search", error: null });
  } catch (err) {
    next(err);
  }
});

// POST /search -> Validate input, process form, and show matching results.
// Now reads from Postgres (was data/tracks.json in Phase 1).
router.post("/search", async (req, res, next) => {
  try {
    const rawKeyword = req.body.keyword;

    // Basic validation: required + trimmed.
    if (!rawKeyword || rawKeyword.trim() === "") {
      return res.render("search", {
        title: "MusicVerse | Search",
        error: "Please enter a search keyword.",
      });
    }

    const keyword = rawKeyword.trim();
    const results = await trackDbService.searchTracksDb(keyword);
    res.render("results", {
      title: "MusicVerse | Search Results",
      keyword,
      results,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
