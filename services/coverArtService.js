// services/coverArtService.js
//
// Gives every track a REAL music photo (an actual song/album cover or
// artist shot - not a generic genre-note icon).
//
// The dataset (data/tracks.json) is synthetic - the artist/track names
// aren't real songs - so searching Deezer/iTunes for an exact
// "artist + title" match either fails or accidentally matches an
// unrelated real song, which looked wrong/random in practice.
//
// Instead, for each genre in the dataset we pull a POOL of real cover
// photos from actual popular songs in that genre (via Deezer, with
// iTunes as a fallback), then hand each track in that genre one photo
// from the pool (cycling through so neighboring tracks don't repeat the
// same photo). Every photo is a genuine music photo; none of them are
// the old SVG note icon unless we truly have no internet at all.
//
// Everything is cached to data/coverArt.json so the network is only
// ever hit once, ever, per genre.

const https = require("https");
const fs = require("fs");
const path = require("path");

const CACHE_PATH = path.join(__dirname, "..", "data", "coverArt.json");
const POOL_SIZE = 20; // real photos fetched per genre
const REQUEST_TIMEOUT_MS = 6000;
const DELAY_BETWEEN_REQUESTS_MS = 200;

// cache shape on disk: { tracks: { <trackKey>: url }, pools: { <genre>: [url, ...] } }
let cache = loadCacheFromDisk();

function loadCacheFromDisk() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    return { tracks: parsed.tracks || {}, pools: parsed.pools || {} };
  } catch {
    return { tracks: {}, pools: {} };
  }
}

function saveCacheToDisk() {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn("[coverArtService] Could not save cover art cache:", err.message);
  }
}

function cacheKeyFor(track) {
  return track.track_id || track.spotifyTrackId || String(track.id);
}

// Returns a cached real-photo URL for a track, or null if we don't have
// one yet (caller should fall back to the genre icon in that case).
function getCachedCover(key) {
  return cache.tracks[key] || null;
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { timeout: REQUEST_TIMEOUT_MS, headers: { "User-Agent": "MusicVerse/1.0" } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A handful of genres search better with a slightly different query than
// their raw dataset label.
const SEARCH_TERM_OVERRIDES = {
  "R&B": "rnb soul",
  "Hip-Hop": "hip hop rap",
  Movie: "movie soundtrack",
};

function searchTermFor(genre) {
  return SEARCH_TERM_OVERRIDES[genre] || genre;
}

async function fetchPoolFromDeezer(genre) {
  const q = encodeURIComponent(searchTermFor(genre));
  const json = await httpGetJson(`https://api.deezer.com/search?q=${q}&limit=${POOL_SIZE}`);
  const results = (json && json.data) || [];
  const urls = results
    .map((r) => r.album && (r.album.cover_big || r.album.cover_medium))
    .filter(Boolean);
  return [...new Set(urls)];
}

async function fetchPoolFromItunes(genre) {
  const term = encodeURIComponent(searchTermFor(genre));
  const json = await httpGetJson(
    `https://itunes.apple.com/search?term=${term}&entity=song&limit=${POOL_SIZE}`
  );
  const results = (json && json.results) || [];
  const urls = results
    .map((r) => r.artworkUrl100 && r.artworkUrl100.replace("100x100bb", "600x600bb"))
    .filter(Boolean);
  return [...new Set(urls)];
}

async function getOrFetchPool(genre) {
  if (cache.pools[genre] && cache.pools[genre].length > 0) {
    return cache.pools[genre];
  }

  let pool = [];
  try {
    pool = await fetchPoolFromDeezer(genre);
  } catch {
    /* try iTunes below */
  }

  if (pool.length < 5) {
    try {
      const fromItunes = await fetchPoolFromItunes(genre);
      pool = [...new Set([...pool, ...fromItunes])];
    } catch {
      /* keep whatever we already have, possibly nothing */
    }
  }

  if (pool.length > 0) {
    cache.pools[genre] = pool;
  }
  return pool;
}

// Called once at startup. Builds a real-photo pool per genre and hands
// every track a photo from its genre's pool (cycling through the pool
// so consecutive tracks get different photos). Safe to call repeatedly -
// already-assigned tracks are skipped. Non-blocking for the caller to
// invoke without awaiting.
async function warmCoverArtCache(tracks) {
  const missing = tracks.filter((t) => !getCachedCover(cacheKeyFor(t)));
  if (missing.length === 0) return;

  console.log(`[coverArtService] Fetching real music photos for ${missing.length} track(s)...`);

  const genres = [...new Set(missing.map((t) => t.genre))];
  const genreCounters = {};
  let found = 0;

  for (const genre of genres) {
    const pool = await getOrFetchPool(genre);
    genreCounters[genre] = 0;

    const tracksInGenre = missing.filter((t) => t.genre === genre);
    for (const track of tracksInGenre) {
      if (pool.length > 0) {
        const url = pool[genreCounters[genre] % pool.length];
        cache.tracks[cacheKeyFor(track)] = url;
        genreCounters[genre]++;
        found++;
      }
    }

    saveCacheToDisk(); // persist progress after each genre in case of a crash
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  console.log(
    `[coverArtService] Done - ${found}/${missing.length} tracks got a real music photo` +
      (found < missing.length ? " (the rest fall back to the genre icon)." : ".")
  );
}

module.exports = {
  cacheKeyFor,
  getCachedCover,
  warmCoverArtCache,
};
