// models/Track.js
// WEB700 Project Part 3 - Phase 0/1
// Sequelize model that maps to the "tracks" table in Neon/Postgres.
//
// The JSON dataset (data/tracks.json) nests ten audio-feature fields under
// "audioFeatures". Postgres/Sequelize works best with a flat row, so those
// fields are flattened into real columns here. services/trackDbService.js
// reshapes rows back into the original { ...track, audioFeatures: {...} }
// JSON shape so the existing EJS views and API responses don't need to
// change.

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Track = sequelize.define(
  "Track",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    genre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    artistName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "artist_name",
    },
    trackName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "track_name",
    },
    spotifyTrackId: {
      type: DataTypes.STRING,
      field: "track_id",
    },
    popularity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    durationMs: {
      type: DataTypes.INTEGER,
      field: "duration_ms",
    },
    // Optional user-supplied cover art URL. When set, this takes
    // priority over the auto-fetched real cover art and the genre
    // fallback icon (see coverForTrack() in trackDbService.js).
    coverImageUrl: {
      type: DataTypes.STRING,
      field: "cover_image_url",
      allowNull: true,
    },
    // ---- flattened audio features ----
    acousticness: DataTypes.FLOAT,
    danceability: DataTypes.FLOAT,
    energy: DataTypes.FLOAT,
    instrumentalness: DataTypes.FLOAT,
    liveness: DataTypes.FLOAT,
    loudness: DataTypes.FLOAT,
    speechiness: DataTypes.FLOAT,
    tempo: DataTypes.FLOAT,
    valence: DataTypes.FLOAT,
    musicKey: {
      type: DataTypes.STRING,
      field: "key",
    },
    mode: DataTypes.STRING,
    timeSignature: {
      type: DataTypes.INTEGER,
      field: "time_signature",
    },
  },
  {
    tableName: "tracks",
    timestamps: true, // adds createdAt / updatedAt columns
  }
);

module.exports = Track;
