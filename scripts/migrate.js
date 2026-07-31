// scripts/migrate.js
// WEB700 Project Part 3 - Phase 0
// One-off script: creates the "tracks" table (if it doesn't exist) and
// loads data/tracks.json into it. Run with:
//
//   npm run migrate
//
// Requires a valid DATABASE_URL in .env (see .env.example).

const sequelize = require("../config/database");
const Track = require("../models/Track");
const tracks = require("../data/tracks.json");

async function migrate() {
  try {
    console.log("[migrate] Connecting to Neon...");
    await sequelize.authenticate();
    console.log("[migrate] Connection OK.");

    console.log('[migrate] Syncing "tracks" table...');
    // force: true drops and recreates the table - fine for this one-time
    // JSON -> Postgres migration, since data/tracks.json is the source of
    // truth and the script is safe to re-run.
    await sequelize.sync({ force: true });

    console.log(`[migrate] Inserting ${tracks.length} records...`);
    const rows = tracks.map((t) => ({
      id: t.id,
      genre: t.genre,
      artistName: t.artist_name,
      trackName: t.track_name,
      spotifyTrackId: t.track_id,
      popularity: t.popularity,
      durationMs: t.duration_ms,
      coverImageUrl: t.cover_image_url || null,
      acousticness: t.audioFeatures.acousticness,
      danceability: t.audioFeatures.danceability,
      energy: t.audioFeatures.energy,
      instrumentalness: t.audioFeatures.instrumentalness,
      liveness: t.audioFeatures.liveness,
      loudness: t.audioFeatures.loudness,
      speechiness: t.audioFeatures.speechiness,
      tempo: t.audioFeatures.tempo,
      valence: t.audioFeatures.valence,
      musicKey: t.audioFeatures.key,
      mode: t.audioFeatures.mode,
      timeSignature: t.audioFeatures.time_signature,
    }));

    await Track.bulkCreate(rows);

    // We inserted explicit "id" values above, so bump Postgres's identity/
    // serial sequence past the highest one we used. Without this, the next
    // POST /api/items (which lets Postgres assign the id) could collide
    // with an id we just inserted.
    await sequelize.query(
      `SELECT setval(pg_get_serial_sequence('tracks', 'id'), (SELECT MAX(id) FROM tracks));`
    );

    const count = await Track.count();
    console.log(`[migrate] Done. "tracks" table now has ${count} rows.`);
  } catch (err) {
    console.error("[migrate] Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
