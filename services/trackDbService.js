// services/trackDbService.js
// WEB700 Project Part 3 - Phase 1
// Data-access layer over the Neon Postgres "tracks" table (via Sequelize).
// This is the DB-backed twin of services/trackService.js (the original
// JSON-backed version, still used by /search and /genres for now).
//
// toApiShape() reshapes a flat Sequelize row back into the original
// { ...track, audioFeatures: {...} } JSON structure so the existing EJS
// views and JSON API consumers keep working unchanged.

const { Op } = require("sequelize");
const Track = require("../models/Track");
const { cacheKeyFor, getCachedCover } = require("./coverArtService");

function genreSlug(genre) {
  if (!genre) return "default";
  return String(genre)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "-");
}

function coverForGenre(genre) {
  return `/images/covers/${genreSlug(genre)}.svg`;
}

// Cover art priority:
//   1. A user-supplied image URL (t.coverImageUrl), set via the
//      "Cover Image URL" field on the add/edit track form.
//   2. A real cover/single art photo we auto-fetched and cached.
//   3. The genre SVG icon fallback.
function coverForTrack(t) {
  if (t.coverImageUrl && t.coverImageUrl.trim()) return t.coverImageUrl.trim();
  const realCover = getCachedCover(cacheKeyFor({ track_id: t.spotifyTrackId, id: t.id }));
  return realCover || coverForGenre(t.genre);
}

function toApiShape(row) {
  const t = row.get({ plain: true });
  return {
    id: t.id,
    genre: t.genre,
    artist_name: t.artistName,
    track_name: t.trackName,
    track_id: t.spotifyTrackId,
    popularity: t.popularity,
    duration_ms: t.durationMs,
    cover_image_url: t.coverImageUrl || null,
    audioFeatures: {
      acousticness: t.acousticness,
      danceability: t.danceability,
      energy: t.energy,
      instrumentalness: t.instrumentalness,
      liveness: t.liveness,
      loudness: t.loudness,
      speechiness: t.speechiness,
      tempo: t.tempo,
      valence: t.valence,
      key: t.musicKey,
      mode: t.mode,
      time_signature: t.timeSignature,
    },
    cover: coverForTrack(t),
  };
}

// SELECT - used by GET /api/items and GET /items
async function getAllTracksDb({ genre, minPopularity, sortBy } = {}) {
  const where = {};
  if (genre) where.genre = { [Op.iLike]: genre };
  if (minPopularity && !Number.isNaN(Number(minPopularity))) {
    where.popularity = { [Op.gte]: Number(minPopularity) };
  }

  let order = [["id", "ASC"]];
  if (sortBy === "popularity") order = [["popularity", "DESC"]];
  if (sortBy === "danceability") order = [["danceability", "DESC"]];

  const rows = await Track.findAll({ where, order });
  return rows.map(toApiShape);
}

// SELECT (single row) - used by GET /api/items/:id and GET /items/:id
async function getTrackByIdDb(id) {
  const row = await Track.findByPk(id);
  return row ? toApiShape(row) : null;
}

// INSERT - the "second meaningful interaction" for Phase 1, used by
// POST /api/items
async function createTrackDb(payload) {
  const row = await Track.create({
    genre: payload.genre,
    artistName: payload.artist_name,
    trackName: payload.track_name,
    spotifyTrackId: payload.track_id || null,
    popularity: payload.popularity ?? 0,
    durationMs: payload.duration_ms ?? 0,
    coverImageUrl: payload.cover_image_url?.trim() || null,
    acousticness: payload.audioFeatures?.acousticness ?? 0,
    danceability: payload.audioFeatures?.danceability ?? 0,
    energy: payload.audioFeatures?.energy ?? 0,
    instrumentalness: payload.audioFeatures?.instrumentalness ?? 0,
    liveness: payload.audioFeatures?.liveness ?? 0,
    loudness: payload.audioFeatures?.loudness ?? 0,
    speechiness: payload.audioFeatures?.speechiness ?? 0,
    tempo: payload.audioFeatures?.tempo ?? 0,
    valence: payload.audioFeatures?.valence ?? 0,
    musicKey: payload.audioFeatures?.key ?? null,
    mode: payload.audioFeatures?.mode ?? null,
    timeSignature: payload.audioFeatures?.time_signature ?? 4,
  });
  return toApiShape(row);
}

async function getGenresDb() {
  const rows = await Track.findAll({
    attributes: [[Track.sequelize.fn("DISTINCT", Track.sequelize.col("genre")), "genre"]],
    order: [["genre", "ASC"]],
  });
  return rows.map((r) => r.get("genre"));
}

// UPDATE - Part 3 completion. Used by PATCH /api/items/:id and
// POST /items/:id/edit. Only touches fields that were actually submitted,
// so a partial update (e.g. just changing popularity) doesn't wipe
// everything else out.
async function updateTrackDb(id, payload) {
  const row = await Track.findByPk(id);
  if (!row) return null;

  const fields = {};
  if (payload.genre !== undefined && payload.genre !== "") fields.genre = payload.genre;
  if (payload.artist_name !== undefined && payload.artist_name !== "")
    fields.artistName = payload.artist_name;
  if (payload.track_name !== undefined && payload.track_name !== "")
    fields.trackName = payload.track_name;
  if (payload.popularity !== undefined && payload.popularity !== "")
    fields.popularity = Number(payload.popularity);
  if (payload.duration_ms !== undefined && payload.duration_ms !== "")
    fields.durationMs = Number(payload.duration_ms);
  // Unlike the other fields, an empty string here is meaningful: it means
  // "clear the custom cover and fall back to auto/genre art again" rather
  // than "field wasn't submitted".
  if (payload.cover_image_url !== undefined)
    fields.coverImageUrl = payload.cover_image_url.trim() || null;

  const af = payload.audioFeatures || {};
  const afMap = {
    acousticness: "acousticness",
    danceability: "danceability",
    energy: "energy",
    instrumentalness: "instrumentalness",
    liveness: "liveness",
    loudness: "loudness",
    speechiness: "speechiness",
    tempo: "tempo",
    valence: "valence",
    key: "musicKey",
    mode: "mode",
    time_signature: "timeSignature",
  };
  Object.keys(afMap).forEach((jsonKey) => {
    if (af[jsonKey] !== undefined && af[jsonKey] !== "") {
      fields[afMap[jsonKey]] =
        jsonKey === "key" || jsonKey === "mode" ? af[jsonKey] : Number(af[jsonKey]);
    }
  });

  await row.update(fields);
  return toApiShape(row);
}

// DELETE - Part 3 completion. Used by DELETE /api/items/:id and
// POST /items/:id/delete. Returns false (instead of throwing) when the
// record was already gone, so callers can send a clean 404 rather than
// a 500.
async function deleteTrackDb(id) {
  const row = await Track.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

// SEARCH - Part 3 completion. Replaces the old JSON-file-backed search
// (services/trackService.js) so /search and /api/search read from
// Postgres like every other route now does.
async function searchTracksDb(keyword) {
  const like = { [Op.iLike]: `%${keyword}%` };
  const rows = await Track.findAll({
    where: {
      [Op.or]: [{ artistName: like }, { trackName: like }, { genre: like }],
    },
    order: [["id", "ASC"]],
  });
  return rows.map(toApiShape);
}

module.exports = {
  getAllTracksDb,
  getTrackByIdDb,
  createTrackDb,
  updateTrackDb,
  deleteTrackDb,
  searchTracksDb,
  getGenresDb,
  coverForGenre,
};
