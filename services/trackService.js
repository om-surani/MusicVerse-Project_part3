// services/trackService.js
// Small data-access layer around the local tracks.json file.
// Keeping this logic out of the route files makes both the API routes
// and the HTML/EJS routes able to share the exact same search/filter logic.

const tracks = require("../data/tracks.json");
const { cacheKeyFor, getCachedCover } = require("./coverArtService");

// ---- Cover art helper ----
// Each track now gets its REAL cover/single art (fetched and cached by
// coverArtService.js from Deezer/iTunes). If we haven't been able to
// look that up yet (e.g. no internet on this run), it falls back to the
// locally-generated SVG icon (public/images/covers/<genre-slug>.svg)
// based on genre, same as before.
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

function withCover(track) {
  const realCover = getCachedCover(cacheKeyFor(track));
  return { ...track, cover: realCover || coverForGenre(track.genre) };
}

function getAllTracks({ genre, minPopularity, sortBy } = {}) {
  let result = [...tracks];

  if (genre) {
    result = result.filter(
      (t) => t.genre.toLowerCase() === String(genre).toLowerCase()
    );
  }

  if (minPopularity) {
    const min = Number(minPopularity);
    if (!Number.isNaN(min)) {
      result = result.filter((t) => t.popularity >= min);
    }
  }

  if (sortBy === "popularity") {
    result.sort((a, b) => b.popularity - a.popularity);
  } else if (sortBy === "danceability") {
    result.sort(
      (a, b) => b.audioFeatures.danceability - a.audioFeatures.danceability
    );
  }

  return result.map(withCover);
}

function getTrackById(id) {
  const track = tracks.find(
    (t) => String(t.id) === String(id) || t.track_id === id
  );
  return track ? withCover(track) : null;
}

function searchTracks(keyword) {
  if (!keyword) return [];
  const term = keyword.toLowerCase().trim();
  return tracks
    .filter(
      (t) =>
        t.track_name.toLowerCase().includes(term) ||
        t.artist_name.toLowerCase().includes(term) ||
        t.genre.toLowerCase().includes(term)
    )
    .map(withCover);
}

function getGenres() {
  return [...new Set(tracks.map((t) => t.genre))].sort();
}

module.exports = {
  getAllTracks,
  getTrackById,
  searchTracks,
  getGenres,
  coverForGenre,
};
